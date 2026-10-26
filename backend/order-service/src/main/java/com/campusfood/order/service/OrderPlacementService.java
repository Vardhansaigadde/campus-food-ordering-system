package com.campusfood.order.service;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.campusfood.order.client.AuthClient;
import com.campusfood.order.client.RemoteCalls;
import com.campusfood.order.client.RestaurantClient;
import com.campusfood.order.common.ApiException;
import com.campusfood.order.common.CurrentUser;
import com.campusfood.order.domain.DailyCounterRepository;
import com.campusfood.order.domain.Fulfilment;
import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderItem;
import com.campusfood.order.domain.OrderRepository;
import com.campusfood.order.domain.OrderStatus;
import com.campusfood.order.dto.OrderView;
import com.campusfood.order.dto.Requests;

/**
 * Placing an order – the busiest operation during the lunch rush.
 *
 * <ol>
 *   <li>Same Idempotency-Key again (double click / retry)? Return the order already created.</li>
 *   <li>Check limits: max 7 of a dish, max 3 active orders, no ban for no-shows (Auth Service).</li>
 *   <li>Reserve the plates in the Restaurant Service – it also checks open/closed and takes prices from its DB.</li>
 *   <li>Save the order with a short token (MC-127) and a random 4-digit OTP.</li>
 *   <li>If saving fails, give the plates back (compensating action, like a mini "saga").</li>
 * </ol>
 */
@Service
public class OrderPlacementService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int PREORDER_MIN_MINUTES = 15;
    private static final LocalTime LAST_PICKUP = LocalTime.of(23, 0);
    /** Same threshold the menu uses for "Only N left". */
    private static final int LOW_STOCK = 5;

    private final OrderRepository orders;
    private final DailyCounterRepository counters;
    private final RemoteCalls remote;
    private final Notifier notifier;
    private final OrderQueryService queries;
    private final TransactionTemplate tx;
    private final int maxActiveOrders;
    private final int maxQuantity;

    public OrderPlacementService(OrderRepository orders, DailyCounterRepository counters, RemoteCalls remote,
                                 Notifier notifier, OrderQueryService queries, TransactionTemplate tx,
                                 @Value("${app.order.max-active-orders}") int maxActiveOrders,
                                 @Value("${app.order.max-quantity-per-dish}") int maxQuantity) {
        this.orders = orders;
        this.counters = counters;
        this.remote = remote;
        this.notifier = notifier;
        this.queries = queries;
        this.tx = tx;
        this.maxActiveOrders = maxActiveOrders;
        this.maxQuantity = maxQuantity;
    }

    public OrderView place(CurrentUser student, Requests.PlaceOrder req, String idempotencyKey) {
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null
                : student.id() + ":" + idempotencyKey.trim().substring(0, Math.min(idempotencyKey.trim().length(), 40));

        if (key != null) {
            Long existing = orders.findByIdempotencyKey(key).map(Order::getId).orElse(null);
            if (existing != null) {
                return queries.forStudent(existing, student.id());
            }
        }

        List<RestaurantClient.Item> items = mergeAndValidate(req.items());
        DeliveryPlan delivery = req.delivery() == null ? null : planDelivery(student, req);
        if (delivery == null) {
            validatePickupTime(req.pickupTime());
        }

        AuthClient.Eligibility eligibility = remote.eligibility(student.id());
        if (!eligibility.allowed()) {
            throw ApiException.forbidden(eligibility.reason());
        }
        if (orders.countByStudentIdAndStatusIn(student.id(), OrderStatus.ACTIVE) >= maxActiveOrders) {
            throw ApiException.conflict("You already have " + maxActiveOrders
                    + " active orders. Collect one before ordering again.");
        }

        RestaurantClient.Reservation reservation = remote.reserve(req.restaurantId(), items);
        if (delivery == null && req.pickupTime() != null && !reservation.preordersEnabled()) {
            remote.release(req.restaurantId(), items);
            throw ApiException.badRequest(reservation.restaurantName() + " is not taking pre-orders right now. Order for as soon as possible instead.");
        }
        BigDecimal minOrder = delivery == null ? null : delivery.quote().minOrder();
        if (minOrder != null && reservation.total().compareTo(minOrder) < 0) {
            remote.release(req.restaurantId(), items);
            throw ApiException.badRequest("Minimum order for delivery is ₹" + minOrder.stripTrailingZeros().toPlainString()
                    + " (your food is ₹" + reservation.total().stripTrailingZeros().toPlainString() + ")");
        }
        Long orderId;
        try {
            orderId = tx.execute(status -> save(student, req, key, reservation, delivery));
        } catch (DataIntegrityViolationException duplicate) {
            remote.release(req.restaurantId(), items);
            if (key != null) {
                Long existing = orders.findByIdempotencyKey(key).map(Order::getId).orElse(null);
                if (existing != null) {
                    return queries.forStudent(existing, student.id());
                }
            }
            throw ApiException.conflict("Could not place the order, please try again");
        } catch (RuntimeException e) {
            remote.release(req.restaurantId(), items);
            throw e;
        }

        OrderView view = queries.forStudent(orderId, student.id());
        Notifier.OrderEvent event = new Notifier.OrderEvent(view.id(), view.token(), view.restaurantId(), student.id(),
                view.status().name());
        String pickup = view.delivery() != null
                ? " · deliver " + view.delivery().run().toLocalTime() + " to " + view.delivery().location() + " " + view.delivery().room()
                : view.pickupTime() != null ? " · pickup " + view.pickupTime().toLocalTime() : "";
        List<OrderView.Item> toCook = view.items().stream().filter(i -> !i.readyMade()).toList();
        if (toCook.isEmpty()) {
            // Ready-made only: nothing for the kitchen to do, so no buzz – the board just updates
            notifier.toRestaurant(event, "ORDER_BOOKED", "Booked " + view.token(),
                    view.items().size() + " item(s) · ₹" + view.total() + pickup);
        } else {
            notifier.toRestaurant(event, "NEW_ORDER", "Cook for " + view.token(),
                    toCook.stream().map(i -> i.quantity() + "× " + i.name()).collect(Collectors.joining(", ")) + pickup);
        }
        stockAlerts(event, reservation);
        return view;
    }

    /** Warn the owner once when a dish runs low, and when it sells out. */
    private void stockAlerts(Notifier.OrderEvent event, RestaurantClient.Reservation reservation) {
        for (RestaurantClient.Line line : reservation.lines()) {
            Integer left = line.stockLeft();
            if (left == null) {
                continue;
            }
            int before = left + line.quantity();
            if (left == 0) {
                notifier.toRestaurant(event, "SOLD_OUT", line.name() + " is sold out",
                        "Students can no longer order it today");
            } else if (before > LOW_STOCK && left <= LOW_STOCK) {
                notifier.toRestaurant(event, "STOCK_LOW", "Only " + left + " " + line.name() + " left",
                        "Cooked more? Add plates on the Today screen");
            }
        }
    }

    /** Checked before any plates are reserved: approved faculty, building, run still open. */
    private record DeliveryPlan(RestaurantClient.DeliveryQuote quote, Long locationId, String room, String phone) {
    }

    private DeliveryPlan planDelivery(CurrentUser student, Requests.PlaceOrder req) {
        AuthClient.DeliveryProfile profile = remote.deliveryProfile(student.id());
        if (!profile.faculty()) {
            throw ApiException.forbidden("Delivery is only for approved faculty. You can ask for it under My account.");
        }
        String room = req.delivery().room() == null || req.delivery().room().isBlank()
                ? profile.deliveryRoom() : req.delivery().room().trim();
        if (room == null || room.isBlank()) {
            throw ApiException.badRequest("Enter the room to deliver to");
        }
        RestaurantClient.DeliveryQuote quote = remote.deliveryQuote(req.restaurantId(), req.delivery().locationId(),
                req.delivery().run());
        return new DeliveryPlan(quote, req.delivery().locationId(), room, profile.phone());
    }

    private Long save(CurrentUser student, Requests.PlaceOrder req, String key,
                      RestaurantClient.Reservation reservation, DeliveryPlan delivery) {
        LocalDate today = LocalDate.now();
        counters.increment(reservation.restaurantId() + ":" + today);
        long number = counters.lastValue();

        Order o = new Order();
        o.setToken(reservation.restaurantCode() + "-" + (100 + number));
        o.setTokenDate(today);
        o.setOtp(String.valueOf(1000 + RANDOM.nextInt(9000)));
        o.setRestaurantId(reservation.restaurantId());
        o.setRestaurantName(reservation.restaurantName());
        o.setStudentId(student.id());
        o.setStudentName(student.name() == null || student.name().isBlank() ? "Student" : student.name());
        o.setTotal(reservation.total());
        o.setPickupTime(req.pickupTime() == null ? null : req.pickupTime().withSecond(0).withNano(0));
        o.setFulfilment(delivery == null ? Fulfilment.PICKUP : Fulfilment.DELIVERY);
        if (delivery != null) {
            // The run time works like a pre-order time: the kitchen view and queue order use it
            o.setPickupTime(delivery.quote().runAt());
            o.setDeliveryLocationId(delivery.locationId());
            o.setDeliveryLocation(delivery.quote().locationName());
            o.setDeliveryRoom(delivery.room());
            o.setDeliveryRun(delivery.quote().runAt());
            o.setDeliveryFee(delivery.quote().fee());
            o.setCustomerPhone(delivery.phone());
            o.setTotal(reservation.total().add(delivery.quote().fee()));
        }
        o.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        o.setIdempotencyKey(key);
        o.setHoldMinutes(reservation.holdMinutes());
        for (RestaurantClient.Line line : reservation.lines()) {
            OrderItem item = new OrderItem();
            item.setDishId(line.dishId());
            item.setName(line.name());
            item.setVeg(line.veg());
            item.setUnitPrice(line.unitPrice());
            item.setQuantity(line.quantity());
            item.setLineTotal(line.lineTotal());
            item.setReadyMade(line.readyMade());
            o.addItem(item);
        }
        // No "accept" tap: ready-made food is collectable at once (or at the pre-order time);
        // anything made fresh goes straight to the kitchen and needs one "Ready" tap.
        LocalDateTime now = LocalDateTime.now();
        o.setAcceptedAt(now);
        if (o.isAllReadyMade()) {
            o.setStatus(OrderStatus.READY);
            o.setReadyAt(o.getPickupTime() != null && o.getPickupTime().isAfter(now) ? o.getPickupTime() : now);
        } else {
            o.setStatus(OrderStatus.PREPARING);
        }
        return orders.saveAndFlush(o).getId();
    }

    private List<RestaurantClient.Item> mergeAndValidate(List<Requests.OrderLine> lines) {
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (Requests.OrderLine line : lines) {
            merged.merge(line.dishId(), line.quantity(), Integer::sum);
        }
        merged.forEach((dishId, qty) -> {
            if (qty > maxQuantity) {
                throw ApiException.badRequest("You can order at most " + maxQuantity + " of the same dish");
            }
        });
        return merged.entrySet().stream().map(e -> new RestaurantClient.Item(e.getKey(), e.getValue())).toList();
    }

    /** Pre-orders: later today, at least 15 minutes from now. */
    private static void validatePickupTime(LocalDateTime pickupTime) {
        if (pickupTime == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        if (!pickupTime.toLocalDate().equals(now.toLocalDate())) {
            throw ApiException.badRequest("Pre-orders can only be for later today");
        }
        if (pickupTime.isBefore(now.plusMinutes(PREORDER_MIN_MINUTES))) {
            throw ApiException.badRequest("Pickup time must be at least " + PREORDER_MIN_MINUTES + " minutes from now");
        }
        if (pickupTime.toLocalTime().isAfter(LAST_PICKUP)) {
            throw ApiException.badRequest("Pickup time must be before 11:00 PM");
        }
    }
}
