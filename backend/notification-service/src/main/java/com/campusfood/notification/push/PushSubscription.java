package com.campusfood.notification.push;

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

/** One phone/browser that agreed to receive alerts even when the app is closed or the screen is locked. */
@Entity
@Table(name = "push_subscriptions", indexes = {
        @Index(name = "idx_push_user", columnList = "userId"),
        @Index(name = "idx_push_restaurant", columnList = "restaurantId")
})
@Getter
@Setter
@NoArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Address at the browser's push service (Google, Mozilla, Apple…). */
    @Column(nullable = false, unique = true, length = 700)
    private String endpoint;

    @Column(nullable = false, length = 120)
    private String p256dh;

    @Column(nullable = false, length = 60)
    private String auth;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 20)
    private String role;

    /** Set for restaurant staff, so every staff phone of that restaurant hears "new order". */
    private Long restaurantId;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
