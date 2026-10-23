package com.campusfood.restaurant.dto;

import java.math.BigDecimal;

import com.campusfood.restaurant.domain.Dish;

/**
 * One dish as shown in the app.
 * {@code onTodayMenu} stays true when a dish sells out (so staff can add plates); {@code availableToday} does not.
 * Students only get {@code stockLeft} when it is low ("Only 3 left!"); staff always get the full numbers.
 */
public record DishView(Long id, Long restaurantId, String name, String description, BigDecimal price,
                       String category, boolean veg, String imageUrl, boolean special, boolean bestseller,
                       boolean availableToday, Integer stockLeft, Integer dailyStock, Long soldCount,
                       Double rating, long ratingCount, boolean readyMade,
                       boolean onTodayMenu) {

    public static final int LOW_STOCK = 5;

    public static DishView forStudent(Dish d, boolean bestseller) {
        Integer low = d.getStockLeft() != null && d.getStockLeft() <= LOW_STOCK ? d.getStockLeft() : null;
        return new DishView(d.getId(), d.getRestaurantId(), d.getName(), d.getDescription(), d.getPrice(),
                d.getCategory(), d.isVeg(), d.getImageUrl(), d.isSpecial(), bestseller, d.isAvailableToday(),
                low, null, null, d.rating(), d.getRatingCount(), d.isReadyMade(), d.isOnTodayMenu());
    }

    public static DishView forStaff(Dish d, boolean bestseller) {
        return new DishView(d.getId(), d.getRestaurantId(), d.getName(), d.getDescription(), d.getPrice(),
                d.getCategory(), d.isVeg(), d.getImageUrl(), d.isSpecial(), bestseller, d.isAvailableToday(),
                d.getStockLeft(), d.getDailyStock(), d.getSoldCount(), d.rating(), d.getRatingCount(), d.isReadyMade(),
                d.isOnTodayMenu());
    }
}
