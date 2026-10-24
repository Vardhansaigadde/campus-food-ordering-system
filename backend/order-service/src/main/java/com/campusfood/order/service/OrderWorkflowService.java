package com.campusfood.order.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.campusfood.order.client.RemoteCalls;
import com.campusfood.order.client.RestaurantClient;
import com.campusfood.order.common.ApiException;
import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderItem;
import com.campusfood.order.domain.OrderRepository;
import com.campusfood.order.domain.OrderStatus;
import com.campusfood.order.dto.OrderView;
import com.campusfood.order.dto.Requests;

/**
 * Everything that happens to an order after it is placed:
 * PLACED -> PREPARING -> READY -> COLLECTED, or CANCELLED / REJECTED / NO_SHOW.
 * Side effects (giving stock back, live notifications) run only after the database change is committed.
 */
@Service
public class OrderWorkflowService {

    private final OrderRepository orders;
    private final TransactionTemplate tx;
    private final RemoteCalls remote;
    private final Notifier notifier;
    private final int otpMaxAttempts;

    public OrderWorkflowService(OrderRepository orders, TransactionTemplate tx, RemoteCalls remote, Notifier notifier,
                                @Value("${app.order.otp-max-attempts}") int otpMaxAttempts) {
        this.orders = orders;
        this.tx = tx;
        this.remote = remote;
        this.notifier = notifier;
        this.otpMaxAttempts = otpMaxAttempts;
    }

    // ---------------------------------------------------------------- student

    /** Before the kitchen starts, or ready-made food not collected yet (the plates go back on sale). */
    public OrderView cancelByStudent(Long studentId, Long orderId) {
        Order o = update(orderId, order -> {
            ownedBy(order, studentId);
            if (!order.isCancellableByStudent()) {
                throw ApiException.conflict("The restaurant has already started this order, so it can't be cancelled");
            }
            order.setStatus(OrderStatus.CANCELLED);
            order.setClosedAt(LocalDateTime.now());
        });
        remote.release(o.getRestaurantId(), items(o));
        notifier.toRestaurant(event(o), "ORDER_CANCELLED", "Order " + o.getToken() + " cancelled",
                "The student cancelled this order");
        return OrderView.forStudent(o, null, null);
    }

    public OrderView rate(Long studentId, Long orderId, Requests.Rate req) {
        Order o = update(orderId, order -> {
            ownedBy(order, studentId);
            if (order.getStatus() != OrderStatus.COLLECTED) {
                throw ApiException.conflict("You can rate an order after collecting it");
            }
            if (order.getRating() != null) {
                throw ApiException.conflict("You have already rated this order");
            }
            order.setRating(req.rating());
            order.setReview(req.review() == null || req.review().isBlank() ? null : req.review().trim());
        });
        Set<Long> dishIds = o.getItems().stream().map(OrderItem::getDishId).collect(Collectors.toSet());
        Map<Long, Integer> stars = o.getItems().stream()
                .collect(Collectors.toMap(OrderItem::getDishId, i -> req.rating(), (a, b) -> a));
        if (req.dishes() != null) {
            req.dishes().stream().filter(d -> dishIds.contains(d.dishId()))
                    .forEach(d -> stars.put(d.dishId(), d.stars()));
        }
        remote.rate(new RestaurantClient.Ratings(o.getRestaurantId(), stars.entrySet().stream()
                .map(e -> new RestaurantClient.DishRating(e.getKey(), e.getValue())).toList()));
        return OrderView.forStudent(o, null, null);
    }

    // ---------------------------------------------------------------- restaurant

    public OrderView accept(Long restaurantId, Long orderId) {
        Order o = update(orderId, order -> {
            belongsTo(order, restaurantId);
            requireStatus(order, EnumSet.of(OrderStatus.PLACED), "accepted");
            order.setStatus(OrderStatus.PREPARING);
            order.setAcceptedAt(LocalDateTime.now());
        });
        notifier.toStudent(event(o), "ORDER_PREPARING", "Order " + o.getToken() + " is being prepared",
                o.getRestaurantName() + " has started your order");
        return OrderView.forStaff(o);
    }

    public OrderView markReady(Long restaurantId, Long orderId) {
        Order o = update(orderId, order -> {
            belongsTo(order, restaurantId);
            requireStatus(order, OrderStatus.IN_QUEUE, "marked ready");
            LocalDateTime now = LocalDateTime.now();
            if (order.getAcceptedAt() == null) {
                order.setAcceptedAt(now);
            }
            order.setStatus(OrderStatus.READY);
            order.setReadyAt(now);
        });
        if (o.isDelivery()) {
            notifier.toStudent(event(o), "ORDER_PREPARING", "Order " + o.getToken() + " is packed",
                    "It goes out with the " + o.getDeliveryRun().toLocalTime() + " delivery to " + o.getDeliveryLocation());
        } else {
            notifier.toStudent(event(o), "ORDER_READY", "Your order " + o.getToken() + " is READY!",
                    "Go to " + o.getRestaurantName() + " and tell your Order ID and OTP (or show the QR code)");
        }
        return OrderView.forStaff(o);
    }

    // ---------------------------------------------------------------- delivery runs

    /**
     * The delivery person leaves for one run: every order for that run that isn't out yet goes with
     * them (also ones nobody tapped "Ready" for – they're packed in the bag), and each customer is told.
     */
    public List<OrderView> startRun(Long restaurantId, String run) {
        LocalDateTime runAt = LocalDate.now().atTime(java.time.LocalTime.parse(run));
        List<Order> leaving = tx.execute(status -> {
            List<Order> found = orders.findForRun(restaurantId, runAt,
                    EnumSet.of(OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY));
            LocalDateTime now = LocalDateTime.now();
            for (Order o : found) {
                if (o.getAcceptedAt() == null) {
                    o.setAcceptedAt(now);
                }
                if (o.getReadyAt() == null || o.getReadyAt().isAfter(now)) {
                    o.setReadyAt(now);
                }
                o.setStatus(OrderStatus.ON_THE_WAY);
                o.setOutForDeliveryAt(now);
                o.getItems().size();
            }
            orders.saveAllAndFlush(found);
            return found;
        });
        if (leaving == null || leaving.isEmpty()) {
            throw ApiException.conflict("No orders waiting for the " + run + " delivery");
        }
        for (Order o : leaving) {
            notifier.toStudent(event(o), "ORDER_ON_THE_WAY", "Order " + o.getToken() + " is on the way",
                    "Coming to " + o.getDeliveryLocation() + ", " + o.getDeliveryRoom()
                            + ". Keep your OTP ready for the delivery person.");
        }
        return leaving.stream().map(OrderView::forStaff).toList();
    }

    /** Nobody was in the room: the food goes back to the counter and becomes a normal pickup. */
    public OrderView deliveryMissed(Long restaurantId, Long orderId) {
        Order o = update(orderId, order -> {
            belongsTo(order, restaurantId);
            requireStatus(order, EnumSet.of(OrderStatus.ON_THE_WAY), "marked as not delivered");
            order.setStatus(OrderStatus.READY);
            order.setDeliveryMissed(true);
            order.setReadyAt(LocalDateTime.now());
        });
        int hold = o.getHoldMinutes() == null ? 45 : o.getHoldMinutes();
        notifier.toStudent(event(o), "ORDER_DELIVERY_MISSED", "We couldn't find you for " + o.getToken(),
                "Nobody was at " + o.getDeliveryLocation() + ", " + o.getDeliveryRoom() + ". Collect it at "
                        + o.getRestaurantName() + " within " + hold + " minutes with your OTP.");
        return OrderView.forStaff(o);
    }

    public OrderView reject(Long restaurantId, Long orderId, String reason) {
        Order o = update(orderId, order -> {
            belongsTo(order, restaurantId);
            requireStatus(order, OrderStatus.IN_QUEUE, "rejected");
            order.setStatus(OrderStatus.REJECTED);
            order.setRejectReason(reason.trim());
            order.setClosedAt(LocalDateTime.now());
        });
        remote.release(o.getRestaurantId(), items(o));
        notifier.toStudent(event(o), "ORDER_REJECTED", "Order " + o.getToken() + " was rejected",
                "Reason: " + o.getRejectReason());
        return OrderView.forStaff(o);
    }

    // ---------------------------------------------------------------- verification at the counter

    /** Staff type the token the student says (e.g. "MC-127") and the 4-digit OTP. */
    public OrderView verify(Long restaurantId, String token, String otp) {
        String normalized = token.trim().toUpperCase(Locale.ROOT).replace(' ', '-');
        LocalDate today = LocalDate.now();
        Long orderId = orders.findByRestaurantIdAndTokenDateAndToken(restaurantId, today, normalized)
                .or(() -> orders.findByRestaurantIdAndTokenDateAndToken(restaurantId, today.minusDays(1), normalized))
                .map(Order::getId)
                .orElseThrow(() -> ApiException.notFound("No order " + normalized + " found for your restaurant today"));
        return checkOtp(restaurantId, orderId, otp);
    }

    /** Staff scan the student's QR code ("CFPS:{orderId}:{otp}"). */
    public OrderView verifyQr(Long restaurantId, String code) {
        String[] parts = code.trim().split(":");
        if (parts.length != 3 || !"CFPS".equals(parts[0]) || !parts[1].matches("\\d+") || !parts[2].matches("\\d{4}")) {
            throw ApiException.badRequest("This QR code is not a Campus Food order");
        }
        return checkOtp(restaurantId, Long.valueOf(parts[1]), parts[2]);
    }

    private record CheckResult(Order order, String error, HttpStatus status) {
    }

    private OrderView checkOtp(Long restaurantId, Long orderId, String otp) {
        // Wrong attempts must be saved even though we answer with an error,
        // so the check runs in its own transaction and the error is thrown afterwards.
        CheckResult result = tx.execute(status -> {
            Order o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
            if (!o.getRestaurantId().equals(restaurantId)) {
                return new CheckResult(null, "This order belongs to another restaurant", HttpStatus.FORBIDDEN);
            }
            switch (o.getStatus()) {
                case COLLECTED -> {
                    return new CheckResult(null, "Order " + o.getToken() + " was already collected at "
                            + o.getCollectedAt().toLocalTime().withNano(0), HttpStatus.CONFLICT);
                }
                case CANCELLED, REJECTED, NO_SHOW -> {
                    return new CheckResult(null, "Order " + o.getToken() + " is " + o.getStatus().name()
                            .toLowerCase(Locale.ROOT).replace('_', '-'), HttpStatus.CONFLICT);
                }
                default -> {
                }
            }
            if (o.isOtpLocked()) {
                return new CheckResult(null, "Too many wrong OTPs for " + o.getToken()
                        + ". Ask the canteen office to unlock it.", HttpStatus.LOCKED);
            }
            if (!o.getOtp().equals(otp)) {
                o.setFailedOtpAttempts(o.getFailedOtpAttempts() + 1);
                int left = otpMaxAttempts - o.getFailedOtpAttempts();
                if (left <= 0) {
                    o.setOtpLocked(true);
                    return new CheckResult(null, "Wrong OTP. Order " + o.getToken() + " is now locked.",
                            HttpStatus.LOCKED);
                }
                return new CheckResult(null, "Wrong OTP – do NOT hand over the food (" + left + " attempts left)",
                        HttpStatus.BAD_REQUEST);
            }
            LocalDateTime now = LocalDateTime.now();
            // Handed over straight from the kitchen without a "Ready" tap – that's fine
            if (o.getAcceptedAt() == null) {
                o.setAcceptedAt(now);
            }
            if (o.getReadyAt() == null || o.getReadyAt().isAfter(now)) {
                o.setReadyAt(now);
            }
            o.setStatus(OrderStatus.COLLECTED);
            o.setCollectedAt(now);
            o.setClosedAt(now);
            o.getItems().size();
            return new CheckResult(o, null, null);
        });
        if (result.error() != null) {
            throw new ApiException(result.status(), result.error());
        }
        Order o = result.order();
        boolean delivered = o.isDelivery() && !o.isDeliveryMissed();
        notifier.toBoth(event(o), "ORDER_COLLECTED", "Order " + o.getToken() + (delivered ? " delivered" : " collected"),
                "Enjoy your meal! You can rate it in My Orders.");
        return OrderView.forStaff(o);
    }

    // ---------------------------------------------------------------- admin

    public OrderView unlockOtp(Long orderId) {
        Order o = update(orderId, order -> {
            order.setOtpLocked(false);
            order.setFailedOtpAttempts(0);
        });
        return OrderView.forStaff(o);
    }

    // ---------------------------------------------------------------- helpers

    /** Loads, changes and saves an order in one transaction (with optimistic locking). */
    private Order update(Long orderId, Consumer<Order> change) {
        return tx.execute(status -> {
            Order o = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order not found"));
            change.accept(o);
            o.getItems().size(); // load items for the response
            orders.saveAndFlush(o);
            return o;
        });
    }

    private static void ownedBy(Order o, Long studentId) {
        if (!o.getStudentId().equals(studentId)) {
            throw ApiException.notFound("Order not found");
        }
    }

    /** A restaurant can only touch its own orders. */
    private static void belongsTo(Order o, Long restaurantId) {
        if (!o.getRestaurantId().equals(restaurantId)) {
            throw ApiException.notFound("Order not found");
        }
    }

    private static void requireStatus(Order o, Set<OrderStatus> allowed, String action) {
        if (!allowed.contains(o.getStatus())) {
            throw ApiException.conflict("Order " + o.getToken() + " is " + o.getStatus() + " and can't be " + action);
        }
    }

    static Notifier.OrderEvent event(Order o) {
        return new Notifier.OrderEvent(o.getId(), o.getToken(), o.getRestaurantId(), o.getStudentId(),
                o.getStatus().name());
    }

    static List<RestaurantClient.Item> items(Order o) {
        return o.getItems().stream().map(i -> new RestaurantClient.Item(i.getDishId(), i.getQuantity())).toList();
    }
}
