package com.campusfood.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderItem;
import com.campusfood.order.domain.OrderStatus;

/**
 * An order as sent to the browser.
 * {@code otp} and {@code qrCode} are filled ONLY for the student who owns the order, and only while
 * it is still active – restaurant staff and admins never see the OTP.
 */
public record OrderView(Long id, String token, Long restaurantId, String restaurantName, Long studentId,
                        String studentName, OrderStatus status, List<Item> items, BigDecimal total,
                        String otp, String qrCode, LocalDateTime pickupTime, String note, String rejectReason,
                        boolean otpLocked, LocalDateTime createdAt, LocalDateTime acceptedAt,
                        LocalDateTime readyAt, LocalDateTime collectedAt, LocalDateTime closedAt,
                        Integer queuePosition, Integer etaMinutes, Integer rating, String review,
                        Integer holdMinutes, boolean cancellable, Delivery delivery) {

    /** Only for delivery orders (null for counter pickup). */
    /** {@code missed}: nobody was in the room, so it became a counter pickup. */
    public record Delivery(String location, String room, LocalDateTime run, BigDecimal fee, String phone,
                           LocalDateTime outAt, boolean missed) {

        static Delivery of(Order o) {
            return o.isDelivery()
                    ? new Delivery(o.getDeliveryLocation(), o.getDeliveryRoom(), o.getDeliveryRun(), o.getDeliveryFee(),
                            o.getCustomerPhone(), o.getOutForDeliveryAt(), o.isDeliveryMissed())
                    : null;
        }
    }

    public record Item(Long dishId, String name, boolean veg, BigDecimal unitPrice, int quantity,
                       BigDecimal lineTotal, boolean readyMade) {

        static Item of(OrderItem i) {
            return new Item(i.getDishId(), i.getName(), i.isVeg(), i.getUnitPrice(), i.getQuantity(), i.getLineTotal(),
                    i.isReadyMade());
        }
    }

    /** QR payload scanned at the counter: order id + OTP. */
    public static String qrPayload(Order o) {
        return "CFPS:" + o.getId() + ":" + o.getOtp();
    }

    public static OrderView forStudent(Order o, Integer queuePosition, Integer etaMinutes) {
        boolean showSecret = OrderStatus.ACTIVE.contains(o.getStatus());
        return build(o, showSecret ? o.getOtp() : null, showSecret ? qrPayload(o) : null, queuePosition, etaMinutes);
    }

    public static OrderView forStaff(Order o) {
        return build(o, null, null, null, null);
    }

    private static OrderView build(Order o, String otp, String qr, Integer queuePosition, Integer eta) {
        return new OrderView(o.getId(), o.getToken(), o.getRestaurantId(), o.getRestaurantName(), o.getStudentId(),
                o.getStudentName(), o.getStatus(), o.getItems().stream().map(Item::of).toList(), o.getTotal(),
                otp, qr, o.getPickupTime(), o.getNote(), o.getRejectReason(), o.isOtpLocked(), o.getCreatedAt(),
                o.getAcceptedAt(), o.getReadyAt(), o.getCollectedAt(), o.getClosedAt(), queuePosition, eta,
                o.getRating(), o.getReview(), o.getHoldMinutes(), o.isCancellableByStudent(), Delivery.of(o));
    }
}
