package com.campusfood.order.service;

import java.time.LocalDateTime;
import java.util.EnumSet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.campusfood.order.client.RemoteCalls;
import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderRepository;
import com.campusfood.order.domain.OrderStatus;

/**
 * Background jobs. Each status change is a conditional update ("only if still READY"),
 * so running two copies of the Order Service never processes an order twice.
 */
@Component
public class OrderJobs {

    private static final Logger log = LoggerFactory.getLogger(OrderJobs.class);
    /** Orders that were never prepared are closed after this many hours. */
    private static final int EXPIRE_HOURS = 12;
    /** Smallest hold time a restaurant can choose; older READY orders are checked every minute. */
    private static final int MIN_HOLD_MINUTES = 10;

    private final OrderRepository orders;
    private final TransactionTemplate tx;
    private final RemoteCalls remote;
    private final Notifier notifier;
    private final int noShowHours;

    public OrderJobs(OrderRepository orders, TransactionTemplate tx, RemoteCalls remote, Notifier notifier,
                     @Value("${app.order.no-show-hours}") int noShowHours) {
        this.orders = orders;
        this.tx = tx;
        this.remote = remote;
        this.notifier = notifier;
        this.noShowHours = noShowHours;
    }

    /**
     * Ready but not collected within the restaurant's hold time (counted from the pickup time for pre-orders)
     * -> NO_SHOW, and the plates go back on sale. 3 no-shows ban ordering for 7 days (Auth Service).
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void markNoShows() {
        LocalDateTime now = LocalDateTime.now();
        for (Long id : orders.findUncollectedReadyIds(now.minusMinutes(MIN_HOLD_MINUTES))) {
            Order candidate = orders.findById(id).orElse(null);
            // Deliveries wait for their run instead; only a missed delivery (now a counter pickup) can be a no-show
            if (candidate == null || (candidate.isDelivery() && !candidate.isDeliveryMissed())
                    || now.isBefore(holdDeadline(candidate))) {
                continue;
            }
            Integer changed = tx.execute(s -> orders.transition(id, EnumSet.of(OrderStatus.READY), OrderStatus.NO_SHOW,
                    LocalDateTime.now()));
            if (changed == null || changed == 0) {
                continue;
            }
            // Items are lazy: read them inside a transaction (open-in-view is off, there is no session here)
            Order o = tx.execute(s -> {
                Order loaded = orders.findById(id).orElseThrow();
                loaded.getItems().size();
                return loaded;
            });
            remote.release(o.getRestaurantId(), OrderWorkflowService.items(o));
            try {
                remote.recordNoShow(o.getStudentId());
            } catch (RuntimeException e) {
                log.warn("No-show for order {} not recorded in Auth Service: {}", id, e.getMessage());
            }
            notifier.toBoth(OrderWorkflowService.event(o), "ORDER_NO_SHOW", "Order " + o.getToken() + " not collected",
                    "Not collected within " + holdMinutes(o) + " minutes, so the food went back on sale. "
                            + "3 no-shows pause ordering for 7 days.");
            log.info("Order {} marked NO_SHOW", o.getToken());
        }
    }

    private int holdMinutes(Order o) {
        return o.getHoldMinutes() != null ? o.getHoldMinutes() : noShowHours * 60;
    }

    private LocalDateTime holdDeadline(Order o) {
        LocalDateTime from = o.getReadyAt();
        if (o.getPickupTime() != null && o.getPickupTime().isAfter(from)) {
            from = o.getPickupTime();
        }
        return from.plusMinutes(holdMinutes(o));
    }

    /** Orders a restaurant never prepared (e.g. it forgot to reject them) are cancelled at the end of the day. */
    @Scheduled(fixedDelay = 30 * 60_000, initialDelay = 60_000)
    public void expireStale() {
        for (Long id : orders.findStaleIds(OrderStatus.IN_QUEUE, LocalDateTime.now().minusHours(EXPIRE_HOURS))) {
            tx.executeWithoutResult(s -> orders.transition(id, OrderStatus.IN_QUEUE, OrderStatus.CANCELLED,
                    LocalDateTime.now()));
        }
    }
}
