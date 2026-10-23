package com.campusfood.restaurant.dto;

import java.time.LocalDateTime;
import java.time.LocalTime;

import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantStatus;

public record RestaurantView(Long id, String name, String code, String description, String location,
                             String imageUrl, String openingHours, RestaurantStatus status,
                             LocalDateTime busyUntil, LocalTime autoCloseTime, Double rating, long ratingCount,
                             long dishesToday, boolean active, int holdMinutes, LocalTime autoOpenTime) {

    public static RestaurantView of(Restaurant r, long dishesToday) {
        RestaurantStatus status = r.effectiveStatus();
        return new RestaurantView(r.getId(), r.getName(), r.getCode(), r.getDescription(), r.getLocation(),
                r.getImageUrl(), r.getOpeningHours(), status,
                status == RestaurantStatus.BUSY ? r.getBusyUntil() : null,
                r.getAutoCloseTime(), r.rating(), r.getRatingCount(), dishesToday, r.isActive(),
                r.holdMinutesOrDefault(), r.getAutoOpenTime());
    }
}
