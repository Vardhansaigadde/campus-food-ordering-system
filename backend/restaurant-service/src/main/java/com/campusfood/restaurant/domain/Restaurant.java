package com.campusfood.restaurant.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "restaurants")
@Getter
@Setter
@NoArgsConstructor
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    /** 2–4 letters used in pickup tokens, e.g. "MC" -> MC-127. */
    @Column(nullable = false, unique = true, length = 4)
    private String code;

    @Column(length = 300)
    private String description;

    @Column(length = 120)
    private String location;

    @Column(length = 500)
    private String imageUrl;

    /** Display text such as "8:00 AM – 8:00 PM". */
    @Column(length = 60)
    private String openingHours;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RestaurantStatus status = RestaurantStatus.CLOSED;

    /** While BUSY: new orders are paused until this time. */
    private LocalDateTime busyUntil;

    /** Restaurant closes itself automatically at this time every day (optional). */
    private LocalTime autoCloseTime;

    /** Day on which the auto-close last ran, so a manual re-open later that day is respected. */
    private LocalDate lastAutoClosedOn;

    /** Opens by itself at this time each morning, with the last day's menu (optional). */
    private LocalTime autoOpenTime;

    /** Day the morning auto-open last ran, so a manual close later that day is respected. */
    private LocalDate lastAutoOpenedOn;

    /** Day the evening summary was last sent to the owner's phone. */
    private LocalDate lastSummaryOn;

    /**
     * Minutes a ready order stays reserved for the student. After that it becomes a no-show
     * and the plates go back on sale. Set by the owner; null = default.
     */
    private Integer holdMinutes;

    // ---------------------------------------------------------------- faculty delivery

    /** The canteen delivers to approved faculty (the owner switches it on in Settings). */
    private boolean deliveryEnabled;

    @Column(precision = 8, scale = 2)
    private BigDecimal deliveryFee;

    /** Smallest food total for a delivery order; null = no minimum. */
    @Column(precision = 8, scale = 2)
    private BigDecimal deliveryMinOrder;

    /** Delivery run times as "12:45,13:30" – one trip per run takes every order for that time. */
    @Column(length = 120)
    private String deliveryRuns;

    /** Orders for a run close this many minutes before it, so the kitchen has time to cook. */
    private Integer deliveryCutoffMinutes;

    /** Buildings this canteen delivers to (ids of {@link DeliveryLocation}). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "restaurant_delivery_locations", joinColumns = @JoinColumn(name = "restaurant_id"))
    @Column(name = "location_id")
    private Set<Long> deliveryLocationIds = new HashSet<>();

    /** False once the admin removes the restaurant. */
    private boolean active = true;

    private long ratingSum;
    private long ratingCount;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public static final int DEFAULT_HOLD_MINUTES = 45;

    public int holdMinutesOrDefault() {
        return holdMinutes == null ? DEFAULT_HOLD_MINUTES : holdMinutes;
    }

    /** BUSY automatically turns back into OPEN when the pause is over. */
    public RestaurantStatus effectiveStatus() {
        if (status == RestaurantStatus.BUSY && busyUntil != null && LocalDateTime.now().isAfter(busyUntil)) {
            return RestaurantStatus.OPEN;
        }
        return status;
    }

    public static final int DEFAULT_DELIVERY_CUTOFF = 30;

    public int deliveryCutoffOrDefault() {
        return deliveryCutoffMinutes == null ? DEFAULT_DELIVERY_CUTOFF : deliveryCutoffMinutes;
    }

    public BigDecimal deliveryFeeOrZero() {
        return deliveryFee == null ? BigDecimal.ZERO : deliveryFee;
    }

    /** Run times in order, e.g. [12:45, 13:30]. */
    public List<LocalTime> deliveryRunTimes() {
        if (deliveryRuns == null || deliveryRuns.isBlank()) {
            return List.of();
        }
        return Arrays.stream(deliveryRuns.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .map(LocalTime::parse).sorted().toList();
    }

    public Double rating() {
        return ratingCount == 0 ? null : Math.round(ratingSum * 10.0 / ratingCount) / 10.0;
    }
}
