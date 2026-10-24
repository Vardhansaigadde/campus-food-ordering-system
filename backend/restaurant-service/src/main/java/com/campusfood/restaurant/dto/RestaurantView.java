package com.campusfood.restaurant.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantStatus;

public record RestaurantView(Long id, String name, String code, String description, String location,
                             String imageUrl, String openingHours, RestaurantStatus status,
                             LocalDateTime busyUntil, LocalTime autoCloseTime, Double rating, long ratingCount,
                             long dishesToday, boolean active, int holdMinutes, LocalTime autoOpenTime,
                             Delivery delivery) {

    /** Faculty delivery settings – the checkout uses them to offer delivery and list the runs. */
    public record Delivery(boolean enabled, BigDecimal fee, BigDecimal minOrder, List<LocalTime> runs,
                           int cutoffMinutes, List<Long> locationIds) {

        static Delivery of(Restaurant r) {
            return new Delivery(r.isDeliveryEnabled(), r.deliveryFeeOrZero(), r.getDeliveryMinOrder(),
                    r.deliveryRunTimes(), r.deliveryCutoffOrDefault(),
                    r.getDeliveryLocationIds().stream().sorted().toList());
        }
    }

    public static RestaurantView of(Restaurant r, long dishesToday) {
        RestaurantStatus status = r.effectiveStatus();
        return new RestaurantView(r.getId(), r.getName(), r.getCode(), r.getDescription(), r.getLocation(),
                r.getImageUrl(), r.getOpeningHours(), status,
                status == RestaurantStatus.BUSY ? r.getBusyUntil() : null,
                r.getAutoCloseTime(), r.rating(), r.getRatingCount(), dishesToday, r.isActive(),
                r.holdMinutesOrDefault(), r.getAutoOpenTime(), Delivery.of(r));
    }
}
