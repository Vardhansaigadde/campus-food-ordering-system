package com.campusfood.restaurant.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.Dish;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantStatus;
import com.campusfood.restaurant.dto.Requests;
import com.campusfood.restaurant.dto.ReservationResult;

/**
 * Called by the Order Service (through Feign) when a student places, cancels or rates an order.
 */
@Service
public class StockService {

    private final DishRepository dishes;
    private final RestaurantService restaurantService;

    public StockService(DishRepository dishes, RestaurantService restaurantService) {
        this.dishes = dishes;
        this.restaurantService = restaurantService;
    }

    /**
     * Checks the restaurant is open, every dish is on today's menu, and reserves the plates.
     * All-or-nothing: if any dish is short, the whole transaction is rolled back.
     */
    @Transactional
    @CacheEvict(cacheNames = MenuService.MENU_CACHE, allEntries = true)
    public ReservationResult reserve(Long restaurantId, List<Requests.ReserveItem> items) {
        Restaurant r = restaurantService.getActive(restaurantId);
        RestaurantStatus status = r.effectiveStatus();
        if (status == RestaurantStatus.CLOSED) {
            throw ApiException.conflict(r.getName() + " is closed right now");
        }
        if (status == RestaurantStatus.BUSY) {
            throw ApiException.conflict(r.getName() + " is very busy. New orders open again at "
                    + r.getBusyUntil().toLocalTime().withSecond(0).withNano(0));
        }

        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (Requests.ReserveItem item : items) {
            quantities.merge(item.dishId(), item.quantity(), Integer::sum);
        }
        Map<Long, Dish> found = dishes.findByIdInAndDeletedFalse(quantities.keySet()).stream()
                .collect(Collectors.toMap(Dish::getId, Function.identity()));

        LocalDate today = LocalDate.now();
        List<ReservationResult.Line> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> e : quantities.entrySet()) {
            Dish d = found.get(e.getKey());
            int qty = e.getValue();
            if (d == null || !d.getRestaurantId().equals(restaurantId) || !today.equals(d.getAvailableDate())) {
                throw ApiException.conflict((d == null ? "A dish" : d.getName()) + " is not available today");
            }
            if (qty > 7) {
                throw ApiException.badRequest("You can order at most 7 of " + d.getName());
            }
            int updated = d.getStockLeft() == null
                    ? dishes.reserveUnlimited(d.getId(), qty)
                    : dishes.reserveLimited(d.getId(), qty);
            if (updated == 0) {
                throw new ApiException(HttpStatus.CONFLICT, d.getStockLeft() == null || d.getStockLeft() <= 0
                        ? d.getName() + " just sold out"
                        : "Only " + d.getStockLeft() + " left of " + d.getName());
            }
            BigDecimal lineTotal = d.getPrice().multiply(BigDecimal.valueOf(qty));
            Integer left = d.getStockLeft() == null ? null : Math.max(0, d.getStockLeft() - qty);
            lines.add(new ReservationResult.Line(d.getId(), d.getName(), d.isVeg(), d.getPrice(), qty, lineTotal,
                    d.isReadyMade(), left));
            total = total.add(lineTotal);
        }
        return new ReservationResult(r.getId(), r.getName(), r.getCode(), lines, total, r.holdMinutesOrDefault(),
                r.isPreordersEnabled());
    }

    /** Puts plates back after a cancel / reject (only affects today's stock). */
    @Transactional
    @CacheEvict(cacheNames = MenuService.MENU_CACHE, allEntries = true)
    public void release(List<Requests.ReserveItem> items) {
        LocalDate today = LocalDate.now();
        for (Requests.ReserveItem item : items) {
            dishes.release(item.dishId(), item.quantity(), today);
        }
    }

    @Transactional
    @CacheEvict(cacheNames = MenuService.MENU_CACHE, allEntries = true)
    public void rate(Requests.Ratings req) {
        int sum = 0;
        for (Requests.DishRating rating : req.ratings()) {
            dishes.addRating(rating.dishId(), rating.stars());
            sum += rating.stars();
        }
        restaurantService.addRating(req.restaurantId(), Math.round((float) sum / req.ratings().size()));
    }
}
