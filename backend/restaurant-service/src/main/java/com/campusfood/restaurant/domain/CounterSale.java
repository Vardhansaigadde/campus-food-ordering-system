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
 * A plate sold directly at the counter to a walk-in customer (no app order).
 * It comes out of the same daily stock, so the app never sells plates that are already gone,
 * and the day summary shows every sale – the notebook is no longer needed at all.
 */
@Entity
@Table(name = "counter_sales", indexes = @Index(name = "idx_counter_restaurant_day", columnList = "restaurantId, saleDate"))
@Getter
@Setter
@NoArgsConstructor
public class CounterSale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long restaurantId;

    @Column(nullable = false)
    private Long dishId;

    @Column(nullable = false, length = 80)
    private String dishName;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private LocalDate saleDate;

    @Column(nullable = false)
    private LocalDateTime soldAt = LocalDateTime.now();
}
