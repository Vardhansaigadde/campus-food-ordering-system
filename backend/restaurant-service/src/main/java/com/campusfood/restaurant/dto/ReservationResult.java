package com.campusfood.restaurant.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Returned to the Order Service after stock is reserved.
 * Prices come from the database here – never from the browser – so nobody can change a price.
 */
public record ReservationResult(Long restaurantId, String restaurantName, String restaurantCode,
                                List<Line> lines, BigDecimal total, int holdMinutes) {

    /** {@code stockLeft} = plates left after this reservation (null = no limit), for low-stock alerts. */
    public record Line(Long dishId, String name, boolean veg, BigDecimal unitPrice, int quantity,
                       BigDecimal lineTotal, boolean readyMade, Integer stockLeft) {
    }
}
