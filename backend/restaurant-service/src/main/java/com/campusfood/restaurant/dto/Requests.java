package com.campusfood.restaurant.dto;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

import com.campusfood.restaurant.domain.RestaurantStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** All request bodies of the Restaurant Service. */
public final class Requests {

    private Requests() {
    }

    /** Admin adds a restaurant together with its first staff login. */
    public record CreateRestaurant(
            @NotBlank @Size(max = 80) String name,
            @NotBlank @Pattern(regexp = "^[A-Za-z]{2,4}$", message = "must be 2-4 letters") String code,
            @Size(max = 300) String description,
            @Size(max = 120) String location,
            @Size(max = 500) String imageUrl,
            @Size(max = 60) String openingHours,
            LocalTime autoCloseTime,
            @NotBlank @Email String loginEmail,
            @NotBlank @Size(min = 6, max = 64) String loginPassword) {
    }

    public record UpdateRestaurant(
            @NotBlank @Size(max = 80) String name,
            @Size(max = 300) String description,
            @Size(max = 120) String location,
            @Size(max = 500) String imageUrl,
            @Size(max = 60) String openingHours,
            LocalTime autoCloseTime) {
    }

    /** What restaurant staff may change about their own restaurant. */
    public record UpdateProfile(
            @Size(max = 300) String description,
            @Size(max = 500) String imageUrl,
            @Size(max = 60) String openingHours,
            LocalTime autoCloseTime,
            @Min(10) @Max(240) Integer holdMinutes,
            LocalTime autoOpenTime,
            Boolean preordersEnabled) {
    }

    public record ChangeStatus(@NotNull RestaurantStatus status, @Min(5) @Max(120) Integer busyMinutes) {
    }

    public record AddLogin(@NotBlank @Size(max = 80) String name,
                           @NotBlank @Email String email,
                           @NotBlank @Size(min = 6, max = 64) String password) {
    }

    public record SaveDish(
            @NotBlank @Size(max = 80) String name,
            @Size(max = 300) String description,
            @NotNull @DecimalMin("1.00") @DecimalMax("5000.00") BigDecimal price,
            @NotBlank @Size(max = 40) String category,
            boolean veg,
            @Size(max = 500) String imageUrl,
            @Min(1) @Max(1000) Integer dailyStock,
            boolean special,
            boolean readyMade) {
    }

    /** Plates sold at the counter to a walk-in customer. */
    public record CounterSale(@Min(1) @Max(50) int quantity) {
    }

    /** Toggle a dish on/off for today, optionally with today's plate count. */
    public record Availability(boolean available, @Min(0) @Max(1000) Integer stockLeft) {
    }

    public record Stock(@Min(0) @Max(1000) Integer stockLeft) {
    }

    public record BulkAvailability(boolean available) {
    }

    // ------------------------------------------------------------ internal (Order Service)

    public record ReserveItem(@NotNull Long dishId, @Min(1) @Max(7) int quantity) {
    }

    public record Reserve(@NotEmpty @Size(max = 30) List<@Valid ReserveItem> items) {
    }

    public record DishRating(@NotNull Long dishId, @Min(1) @Max(5) int stars) {
    }

    public record Ratings(@NotNull Long restaurantId, @NotEmpty List<@Valid DishRating> ratings) {
    }
}
