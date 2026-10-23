package com.campusfood.order.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.order.common.ApiException;
import com.campusfood.order.common.PageResponse;
import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderRepository;
import com.campusfood.order.domain.OrderStatus;
import com.campusfood.order.dto.OrderView;

@Service
@Transactional(readOnly = true)
public class OrderQueryService {

    /** Used until a restaurant has enough history today. */
    private static final int DEFAULT_MINUTES_PER_ORDER = 4;

    private final OrderRepository orders;

    public OrderQueryService(OrderRepository orders) {
        this.orders = orders;
    }

    // ---------------------------------------------------------------- student

    public OrderView forStudent(Long orderId, Long studentId) {
        Order o = orders.findById(orderId)
                .filter(x -> x.getStudentId().equals(studentId))
                .orElseThrow(() -> ApiException.notFound("Order not found"));
        return studentView(o);
    }

    public PageResponse<OrderView> myOrders(Long studentId, boolean active, int page, int size) {
        var statuses = active ? OrderStatus.ACTIVE : EnumSet.complementOf(EnumSet.copyOf(OrderStatus.ACTIVE));
        return PageResponse.of(orders.findByStudentIdAndStatusInOrderByCreatedAtDesc(studentId, statuses,
                PageRequest.of(page, Math.min(size, 50))).map(this::studentView));
    }

    /**
     * Live queue position and estimated time:
     * position = orders of the same restaurant still in the kitchen that are due before this one, + 1;
     * minutes per order = average gap between this restaurant's recent "Ready" orders.
     */
    private OrderView studentView(Order o) {
        if (!OrderStatus.IN_QUEUE.contains(o.getStatus())) {
            return OrderView.forStudent(o, null, null);
        }
        int position = (int) orders.countAhead(o.getRestaurantId(), OrderStatus.IN_QUEUE, o.getId(), o.queueTime()) + 1;
        int eta = position * minutesPerOrder(o.getRestaurantId());
        if (o.getPickupTime() != null) {
            long untilPickup = Duration.between(LocalDateTime.now(), o.getPickupTime()).toMinutes();
            eta = (int) Math.max(eta, untilPickup);
        }
        return OrderView.forStudent(o, position, Math.max(eta, 1));
    }

    private int minutesPerOrder(Long restaurantId) {
        List<LocalDateTime> ready = orders.recentReadyTimes(restaurantId, LocalDateTime.now().minusHours(3),
                PageRequest.of(0, 20));
        if (ready.size() < 3) {
            return DEFAULT_MINUTES_PER_ORDER;
        }
        double gap = Duration.between(ready.get(ready.size() - 1), ready.get(0)).toSeconds() / 60.0
                / (ready.size() - 1);
        return (int) Math.min(10, Math.max(1, Math.round(gap)));
    }

    // ---------------------------------------------------------------- restaurant

    public List<OrderView> activeForRestaurant(Long restaurantId) {
        return orders.findActiveForRestaurant(restaurantId, OrderStatus.ACTIVE).stream()
                .map(OrderView::forStaff).toList();
    }

    public PageResponse<OrderView> historyForRestaurant(Long restaurantId, LocalDate date, OrderStatus status,
                                                        int page, int size) {
        LocalDate day = date == null ? LocalDate.now() : date;
        return PageResponse.of(orders.findForRestaurant(restaurantId, day.atStartOfDay(),
                day.plusDays(1).atStartOfDay(), status, PageRequest.of(page, Math.min(size, 100)))
                .map(OrderView::forStaff));
    }

    // ---------------------------------------------------------------- admin

    public PageResponse<OrderView> search(LocalDate from, LocalDate to, Long restaurantId, OrderStatus status,
                                          String q, int page, int size) {
        LocalDate start = from == null ? LocalDate.now() : from;
        LocalDate end = to == null ? start : to;
        String query = q == null || q.isBlank() ? null : q.trim();
        return PageResponse.of(orders.search(start.atStartOfDay(), end.plusDays(1).atStartOfDay(), restaurantId,
                status, query, PageRequest.of(page, Math.min(size, 100))).map(OrderView::forStaff));
    }
}
