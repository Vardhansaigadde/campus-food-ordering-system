package com.campusfood.restaurant.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A dish on a restaurant's full menu. The restaurant adds every dish once, then
 * marks which ones are available each day: a dish is on today's menu only when
 * {@code availableDate == today}, so yesterday's choices never leak into today.
 */
@Entity
@Table(name = "dishes", indexes = @Index(name = "idx_dish_restaurant_date", columnList = "restaurantId, availableDate"))
@Getter
@Setter
@NoArgsConstructor
public class Dish {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long restaurantId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 300)
    private String description;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, length = 40)
    private String category = "Main Course";

    private boolean veg = true;

    @Column(length = 500)
    private String imageUrl;

    /** The day this dish is available on. Anything other than today = not available. */
    private LocalDate availableDate;

    /** Plates left today. null = no limit. */
    private Integer stockLeft;

    /** How many plates to start with each day (null = no limit). */
    private Integer dailyStock;

    /** "Today's Special" badge. */
    private boolean special;

    /**
     * Cooked in advance as a batch (e.g. biryani): orders are confirmed and collectable at once,
     * without the staff having to accept or mark anything. False = made fresh per order (fried rice).
     */
    private boolean readyMade;

    private long soldCount;
    private long ratingSum;
    private long ratingCount;

    private boolean deleted;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isAvailableToday() {
        return !deleted && LocalDate.now().equals(availableDate) && (stockLeft == null || stockLeft > 0);
    }

    /** Switched on for today, even if it has sold out since. */
    public boolean isOnTodayMenu() {
        return !deleted && LocalDate.now().equals(availableDate);
    }

    public Double rating() {
        return ratingCount == 0 ? null : Math.round(ratingSum * 10.0 / ratingCount) / 10.0;
    }
}
