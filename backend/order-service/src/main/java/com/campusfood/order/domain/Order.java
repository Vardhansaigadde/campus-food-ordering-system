package com.campusfood.order.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** JPQL entity name is FoodOrder because ORDER is a reserved word in queries. */
@Entity(name = "FoodOrder")
@Table(name = "orders",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_order_token", columnNames = {"restaurantId", "tokenDate", "token"}),
                @UniqueConstraint(name = "uk_order_idempotency", columnNames = "idempotencyKey")
        },
        indexes = {
                @Index(name = "idx_order_restaurant_status", columnList = "restaurantId, status"),
                @Index(name = "idx_order_student_created", columnList = "studentId, createdAt"),
                @Index(name = "idx_order_status_ready", columnList = "status, readyAt"),
                @Index(name = "idx_order_created", columnList = "createdAt")
        })
@Getter
@Setter
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Short pickup token said at the counter, e.g. "MC-127". Unique per restaurant per day. */
    @Column(nullable = false, length = 12)
    private String token;

    @Column(nullable = false)
    private LocalDate tokenDate;

    /** 4-digit one-time password, shown only to the student who placed the order. */
    @Column(nullable = false, length = 4)
    private String otp;

    @Column(nullable = false)
    private Long restaurantId;

    @Column(nullable = false, length = 80)
    private String restaurantName;

    @Column(nullable = false)
    private Long studentId;

    @Column(nullable = false, length = 80)
    private String studentName;

    /** Plain text, not a MySQL ENUM, so new statuses don't need a database change (see SchemaFixes). */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PLACED;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    /** Pre-order: pick up at this time. null = as soon as possible. */
    private LocalDateTime pickupTime;

    @Column(length = 150)
    private String note;

    /** Same key = same order: protects against double clicks on slow Wi-Fi. */
    @Column(length = 64)
    private String idempotencyKey;

    @Column(length = 150)
    private String rejectReason;

    private int failedOtpAttempts;

    private boolean otpLocked;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime acceptedAt;
    private LocalDateTime readyAt;
    private LocalDateTime collectedAt;
    private LocalDateTime closedAt;

    /** Minutes the food stays reserved once ready (the restaurant's setting when the order was placed). */
    private Integer holdMinutes;

    // ---------------------------------------------------------------- faculty delivery

    /** null on orders from before delivery existed = pickup; read through {@link #isDelivery()}. */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(length = 10)
    private Fulfilment fulfilment;

    private Long deliveryLocationId;

    /** Building name as it was when ordering, e.g. "CSE Block". */
    @Column(length = 60)
    private String deliveryLocation;

    @Column(length = 30)
    private String deliveryRoom;

    /** The delivery run this order goes out with (today at e.g. 12:45). */
    private LocalDateTime deliveryRun;

    @Column(precision = 8, scale = 2)
    private BigDecimal deliveryFee;

    /** So the delivery person can call if they can't find the room. */
    @Column(length = 15)
    private String customerPhone;

    private LocalDateTime outForDeliveryAt;

    /** Nobody was in the room: the order became a normal counter pickup. */
    private boolean deliveryMissed;

    /** Student's overall rating (1-5) after collecting. */
    private Integer rating;

    @Column(length = 300)
    private String review;

    /**
     * Optimistic locking: if two staff tablets update the same order at once,
     * the second update fails instead of silently overwriting the first.
     */
    @Version
    private Long version;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 100)
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }

    public boolean isDelivery() {
        return fulfilment == Fulfilment.DELIVERY;
    }

    /** Only batch-cooked dishes: confirmed and collectable immediately. */
    public boolean isAllReadyMade() {
        return !items.isEmpty() && items.stream().allMatch(OrderItem::isReadyMade);
    }

    /**
     * Before the kitchen starts, or – for ready-made food not yet collected – any time,
     * because the plate simply goes back on sale.
     */
    public boolean isCancellableByStudent() {
        return status == OrderStatus.PLACED || (status == OrderStatus.READY && isAllReadyMade());
    }

    /** Position in the kitchen queue is based on this time. */
    public LocalDateTime queueTime() {
        return pickupTime != null ? pickupTime : createdAt;
    }
}
