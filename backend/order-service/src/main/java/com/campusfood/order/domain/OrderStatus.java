package com.campusfood.order.domain;

import java.util.EnumSet;
import java.util.Set;

public enum OrderStatus {
    /** Student placed the order; the restaurant has not started it yet. Student may still cancel. */
    PLACED,
    /** Restaurant accepted and is preparing it. */
    PREPARING,
    /** Food is ready at the counter (or, for a delivery, packed and waiting for its run). */
    READY,
    /** Delivery only: the canteen's delivery run has left with it. */
    ON_THE_WAY,
    /** Order ID + OTP verified and food handed over (replaces striking it off in the book). */
    COLLECTED,
    /** Cancelled by the student before preparation started (or expired). */
    CANCELLED,
    /** Rejected by the restaurant, e.g. an item ran out. */
    REJECTED,
    /** Ready but not collected within the restaurant's hold time; the plates went back on sale. */
    NO_SHOW;

    /** Orders that still need something to happen. */
    public static final Set<OrderStatus> ACTIVE = EnumSet.of(PLACED, PREPARING, READY, ON_THE_WAY);

    /** Orders still in the kitchen queue. */
    public static final Set<OrderStatus> IN_QUEUE = EnumSet.of(PLACED, PREPARING);
}
