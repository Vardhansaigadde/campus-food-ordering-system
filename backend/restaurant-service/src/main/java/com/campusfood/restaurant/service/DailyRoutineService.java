package com.campusfood.restaurant.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.campusfood.restaurant.client.NotificationClient;
import com.campusfood.restaurant.client.OrderClient;
import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantRepository;

/**
 * Takes the owner's routine jobs off his hands:
 * <ul>
 *   <li><b>Morning:</b> at his "open automatically" time the canteen opens with the last day's menu
 *       and his usual plates per day – unless he already set today's menu himself.</li>
 *   <li><b>Evening:</b> at closing time his phone gets one summary: cash, plates, no-shows.</li>
 * </ul>
 * Each job runs at most once per day per canteen; a failed summary is retried the next minute.
 */
@Service
public class DailyRoutineService {

    private static final Logger log = LoggerFactory.getLogger(DailyRoutineService.class);
    /** Summary time for canteens without an auto-close time. */
    static final LocalTime DEFAULT_SUMMARY_TIME = LocalTime.of(22, 0);

    private final RestaurantRepository restaurants;
    private final DishRepository dishes;
    private final MenuService menus;
    private final CounterSaleService counterSales;
    private final OrderClient orders;
    private final NotificationClient notifications;

    public DailyRoutineService(RestaurantRepository restaurants, DishRepository dishes, MenuService menus,
                               CounterSaleService counterSales, OrderClient orders, NotificationClient notifications) {
        this.restaurants = restaurants;
        this.dishes = dishes;
        this.menus = menus;
        this.counterSales = counterSales;
        this.orders = orders;
        this.notifications = notifications;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 20_000)
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        for (Restaurant r : restaurants.findByActiveTrueOrderByNameAsc()) {
            try {
                autoOpen(r, now);
                eveningSummary(r, now);
            } catch (RuntimeException e) {
                log.warn("Daily routine for {} failed: {}", r.getName(), e.getMessage());
            }
        }
    }

    // ---------------------------------------------------------------- morning

    private void autoOpen(Restaurant r, LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        LocalTime time = now.toLocalTime();
        if (r.getAutoOpenTime() == null || time.isBefore(r.getAutoOpenTime()) || today.equals(r.getLastAutoOpenedOn())) {
            return;
        }
        // Don't re-open a canteen that has already closed for the day
        if (r.getAutoCloseTime() != null && !time.isBefore(r.getAutoCloseTime())) {
            return;
        }
        boolean menuSetToday = !dishes.findByRestaurantIdAndAvailableDateAndDeletedFalse(r.getId(), today).isEmpty();
        int copied = 0;
        if (!menuSetToday) {
            try {
                copied = menus.copyLastDay(r.getId());
            } catch (ApiException e) {
                log.info("Auto-open {}: no earlier menu to copy yet", r.getName());
            }
        }
        if (restaurants.markAutoOpened(r.getId(), today) == 0) {
            return; // another copy of this service already did it
        }
        log.info("Auto-opened {} ({} dishes copied from the last day)", r.getName(), copied);
    }

    // ---------------------------------------------------------------- evening

    private void eveningSummary(Restaurant r, LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        LocalTime at = r.getAutoCloseTime() != null ? r.getAutoCloseTime() : DEFAULT_SUMMARY_TIME;
        if (now.toLocalTime().isBefore(at) || today.equals(r.getLastSummaryOn())) {
            return;
        }
        OrderClient.DaySummary app = orders.daySummary(r.getId(), today);
        CounterSaleService.Summary walkIn = counterSales.summary(r.getId(), today);
        long collected = app.byStatus() == null ? 0 : app.byStatus().getOrDefault("COLLECTED", 0L);
        long noShows = app.byStatus() == null ? 0 : app.byStatus().getOrDefault("NO_SHOW", 0L);
        BigDecimal appCash = app.expectedCash() == null ? BigDecimal.ZERO : app.expectedCash();
        BigDecimal cash = appCash.add(walkIn.amount());

        if (app.totalOrders() > 0 || walkIn.plates() > 0) {
            String message = collected + " app orders + " + walkIn.plates() + " walk-in plates"
                    + (noShows > 0 ? " · " + noShows + " no-show" + (noShows > 1 ? "s" : "") : "")
                    + ". Tap for the full summary.";
            notifications.notify(new NotificationClient.Event(List.of("restaurant:" + r.getId()), "DAY_SUMMARY",
                    "Today: ₹" + cash.stripTrailingZeros().toPlainString() + " cash in box", message,
                    Map.of("restaurantId", r.getId())));
        }
        restaurants.markSummarySent(r.getId(), today);
        log.info("Evening summary sent for {}", r.getName());
    }
}
