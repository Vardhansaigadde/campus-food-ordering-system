package com.campusfood.restaurant.domain;

public enum RestaurantStatus {
    /** Taking orders. */
    OPEN,
    /** Kitchen is flooded: new orders paused for a few minutes. */
    BUSY,
    /** Not taking orders. */
    CLOSED
}
