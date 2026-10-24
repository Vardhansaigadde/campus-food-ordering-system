package com.campusfood.order.client;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Feign client for the Restaurant Service (located through Eureka). */
@FeignClient(name = "restaurant-service")
public interface RestaurantClient {

    @PostMapping("/internal/restaurants/{id}/reserve")
    Reservation reserve(@PathVariable("id") Long restaurantId, @RequestBody Items items);

    @PostMapping("/internal/restaurants/{id}/release")
    void release(@PathVariable("id") Long restaurantId, @RequestBody Items items);

    /** Checks the canteen delivers to that building at that run and returns the fee. */
    @PostMapping("/internal/restaurants/{id}/delivery-quote")
    DeliveryQuote deliveryQuote(@PathVariable("id") Long restaurantId, @RequestBody QuoteRequest request);

    @PostMapping("/internal/ratings")
    void rate(@RequestBody Ratings ratings);

    record Item(Long dishId, int quantity) {
    }

    record Items(List<Item> items) {
    }

    record Reservation(Long restaurantId, String restaurantName, String restaurantCode, List<Line> lines,
                       BigDecimal total, int holdMinutes) {
    }

    /** {@code stockLeft}: plates left after this reservation (null = no limit). */
    record Line(Long dishId, String name, boolean veg, BigDecimal unitPrice, int quantity, BigDecimal lineTotal,
                boolean readyMade, Integer stockLeft) {
    }

    record QuoteRequest(Long locationId, String run) {
    }

    record DeliveryQuote(BigDecimal fee, BigDecimal minOrder, String locationName, LocalDateTime runAt) {
    }

    record DishRating(Long dishId, int stars) {
    }

    record Ratings(Long restaurantId, List<DishRating> ratings) {
    }
}
