package com.campusfood.restaurant.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.Dish;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.dto.DishView;
import com.campusfood.restaurant.dto.Requests;

/**
 * Menus. Students read today's menu thousands of times during lunch, so it is cached in memory;
 * every change to a dish (including stock changes from orders) clears the cache.
 */
@Service
public class MenuService {

    public static final String MENU_CACHE = "menu";
    private static final int BESTSELLER_COUNT = 3;

    private final DishRepository dishes;

    public MenuService(DishRepository dishes) {
        this.dishes = dishes;
    }

    // ---------------------------------------------------------------- student side

    /** Only dishes marked available today and not sold out. Unavailable dishes are never sent to students. */
    @Cacheable(cacheNames = MENU_CACHE, key = "#restaurantId + ':' + T(java.time.LocalDate).now()")
    public List<DishView> todaysMenu(Long restaurantId) {
        List<Dish> menu = dishes.findMenu(restaurantId, LocalDate.now());
        Set<Long> best = bestsellers(dishes.findByRestaurantIdAndDeletedFalseOrderByCategoryAscNameAsc(restaurantId));
        return menu.stream().map(d -> DishView.forStudent(d, best.contains(d.getId()))).toList();
    }

    public List<DishView> searchToday(String q) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return dishes.searchToday(q.trim(), LocalDate.now()).stream()
                .limit(40)
                .map(d -> DishView.forStudent(d, false))
                .toList();
    }

    // ---------------------------------------------------------------- staff / admin side

    public List<DishView> allDishes(Long restaurantId) {
        List<Dish> all = dishes.findByRestaurantIdAndDeletedFalseOrderByCategoryAscNameAsc(restaurantId);
        Set<Long> best = bestsellers(all);
        return all.stream().map(d -> DishView.forStaff(d, best.contains(d.getId()))).toList();
    }

    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public DishView addDish(Long restaurantId, Requests.SaveDish req) {
        Dish d = new Dish();
        d.setRestaurantId(restaurantId);
        apply(d, req);
        return DishView.forStaff(dishes.save(d), false);
    }

    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public DishView updateDish(Long restaurantId, Long dishId, Requests.SaveDish req) {
        Dish d = find(restaurantId, dishId);
        apply(d, req);
        return DishView.forStaff(d, false);
    }

    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public void deleteDish(Long restaurantId, Long dishId) {
        Dish d = find(restaurantId, dishId);
        d.setDeleted(true);
        d.setAvailableDate(null);
    }

    /** The daily on/off switch. Turning a dish on also loads today's plate count. */
    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public DishView setAvailability(Long restaurantId, Long dishId, Requests.Availability req) {
        Dish d = find(restaurantId, dishId);
        if (req.available()) {
            boolean alreadyToday = LocalDate.now().equals(d.getAvailableDate());
            d.setAvailableDate(LocalDate.now());
            if (req.stockLeft() != null) {
                d.setStockLeft(req.stockLeft());
            } else if (!alreadyToday) {
                d.setStockLeft(d.getDailyStock());
            }
        } else {
            d.setAvailableDate(null);
        }
        return DishView.forStaff(d, false);
    }

    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public DishView setStock(Long restaurantId, Long dishId, Integer stockLeft) {
        Dish d = find(restaurantId, dishId);
        d.setStockLeft(stockLeft);
        return DishView.forStaff(d, false);
    }

    /** Turn every dish on (with its daily stock) or off for today. */
    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public int setAllAvailability(Long restaurantId, boolean available) {
        List<Dish> all = dishes.findByRestaurantIdAndDeletedFalseOrderByCategoryAscNameAsc(restaurantId);
        LocalDate today = LocalDate.now();
        for (Dish d : all) {
            if (available) {
                if (!today.equals(d.getAvailableDate())) {
                    d.setAvailableDate(today);
                    d.setStockLeft(d.getDailyStock());
                }
            } else {
                d.setAvailableDate(null);
            }
        }
        return all.size();
    }

    /** "Same as last day": makes today's menu identical to the last day the restaurant set a menu. */
    @Transactional
    @CacheEvict(cacheNames = MENU_CACHE, allEntries = true)
    public int copyLastDay(Long restaurantId) {
        LocalDate today = LocalDate.now();
        LocalDate last = dishes.lastMenuDateBefore(restaurantId, today);
        if (last == null) {
            throw ApiException.badRequest("There is no earlier menu to copy yet");
        }
        List<Dish> previous = dishes.findByRestaurantIdAndAvailableDateAndDeletedFalse(restaurantId, last);
        for (Dish d : previous) {
            d.setAvailableDate(today);
            d.setStockLeft(d.getDailyStock());
        }
        return previous.size();
    }

    private Dish find(Long restaurantId, Long dishId) {
        return dishes.findByIdAndRestaurantIdAndDeletedFalse(dishId, restaurantId)
                .orElseThrow(() -> ApiException.notFound("Dish not found in your restaurant"));
    }

    private static void apply(Dish d, Requests.SaveDish req) {
        d.setName(req.name().trim());
        d.setDescription(req.description() == null || req.description().isBlank() ? null : req.description().trim());
        d.setPrice(req.price());
        d.setCategory(req.category().trim());
        d.setVeg(req.veg());
        d.setImageUrl(req.imageUrl() == null || req.imageUrl().isBlank() ? null : req.imageUrl().trim());
        d.setDailyStock(req.dailyStock());
        d.setSpecial(req.special());
        d.setReadyMade(req.readyMade());
    }

    /** Top sellers of the restaurant get a "Bestseller" badge. */
    private static Set<Long> bestsellers(List<Dish> all) {
        return all.stream()
                .filter(d -> d.getSoldCount() > 0)
                .sorted(Comparator.comparingLong(Dish::getSoldCount).reversed())
                .limit(BESTSELLER_COUNT)
                .map(Dish::getId)
                .collect(Collectors.toSet());
    }
}
