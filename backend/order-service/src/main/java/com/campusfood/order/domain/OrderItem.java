package com.campusfood.order.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A line of an order. Name and price are copied at order time, so later menu changes don't alter old orders. */
@Entity
@Table(name = "order_items", indexes = @Index(name = "idx_item_dish", columnList = "dishId"))
@Getter
@Setter
@NoArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(nullable = false)
    private Long dishId;

    @Column(nullable = false, length = 80)
    private String name;

    private boolean veg;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal unitPrice;

    private int quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal lineTotal;

    /** Cooked in advance (e.g. biryani) – nothing for the kitchen to do, just hand it over. */
    private boolean readyMade;
}
