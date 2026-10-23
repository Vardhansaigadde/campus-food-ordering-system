package com.campusfood.restaurant.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.CounterSale;
import com.campusfood.restaurant.domain.CounterSaleRepository;
import com.campusfood.restaurant.domain.Dish;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.dto.DishView;

import jakarta.persistence.EntityManager;

/** Walk-in sales at the counter, taken from the same daily stock as app orders. */
@Service
public class CounterSaleService {

    private final DishRepository dishes;
    private final CounterSaleRepository sales;
    private final EntityManager em;

    public CounterSaleService(DishRepository dishes, CounterSaleRepository sales, EntityManager em) {
        this.dishes = dishes;
        this.sales = sales;
        this.em = em;
    }

    public record Sold(Long saleId, DishView dish) {
    }

    public record DishTotal(String dish, long plates, BigDecimal amount) {
    }

    public record Summary(LocalDate date, long plates, BigDecimal amount, List<DishTotal> dishes) {
    }

    @Transactional
    @CacheEvict(cacheNames = MenuService.MENU_CACHE, allEntries = true)
    public Sold sell(Long restaurantId, Long dishId, int quantity) {
        Dish d = dishes.findByIdAndRestaurantIdAndDeletedFalse(dishId, restaurantId)
                .orElseThrow(() -> ApiException.notFound("Dish not found in your restaurant"));
        LocalDate today = LocalDate.now();
        if (!today.equals(d.getAvailableDate())) {
            throw ApiException.conflict(d.getName() + " is not on today's menu");
        }
        // Same atomic update as app orders: two sales of the last plate can never both succeed
        int updated = d.getStockLeft() == null
                ? dishes.reserveUnlimited(d.getId(), quantity)
                : dishes.reserveLimited(d.getId(), quantity);
        if (updated == 0) {
            throw new ApiException(HttpStatus.CONFLICT, d.getStockLeft() == null || d.getStockLeft() <= 0
                    ? d.getName() + " is sold out"
                    : "Only " + d.getStockLeft() + " left of " + d.getName());
        }
        CounterSale sale = new CounterSale();
        sale.setRestaurantId(restaurantId);
        sale.setDishId(d.getId());
        sale.setDishName(d.getName());
        sale.setUnitPrice(d.getPrice());
        sale.setQuantity(quantity);
        sale.setSaleDate(today);
        sales.save(sale);
        // The bulk update bypassed this entity; reload the real numbers from the database
        em.refresh(d);
        return new Sold(sale.getId(), DishView.forStaff(d, false));
    }

    /** Undo a mistaken tap – only for today's sales, and the plates go back into stock. */
    @Transactional
    @CacheEvict(cacheNames = MenuService.MENU_CACHE, allEntries = true)
    public DishView undo(Long restaurantId, Long saleId) {
        CounterSale sale = sales.findByIdAndRestaurantId(saleId, restaurantId)
                .orElseThrow(() -> ApiException.notFound("Sale not found"));
        if (!LocalDate.now().equals(sale.getSaleDate())) {
            throw ApiException.conflict("Only today's counter sales can be undone");
        }
        dishes.release(sale.getDishId(), sale.getQuantity(), sale.getSaleDate());
        sales.delete(sale);
        Dish d = dishes.findById(sale.getDishId()).orElse(null);
        if (d == null) {
            return null;
        }
        em.refresh(d);
        return DishView.forStaff(d, false);
    }

    public Summary summary(Long restaurantId, LocalDate date) {
        List<DishTotal> rows = sales.summary(restaurantId, date).stream()
                .map(r -> new DishTotal((String) r[0], ((Number) r[1]).longValue(), (BigDecimal) r[2]))
                .toList();
        long plates = rows.stream().mapToLong(DishTotal::plates).sum();
        BigDecimal amount = rows.stream().map(DishTotal::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Summary(date, plates, amount, rows);
    }
}
