package com.campusfood.restaurant.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A place food can be delivered to, e.g. "CSE Block". The admin keeps one shared list so that
 * every canteen and every faculty member uses the same names, and deliveries can be grouped by building.
 */
@Entity
@Table(name = "delivery_locations")
@Getter
@Setter
@NoArgsConstructor
public class DeliveryLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    /** Hidden from new orders when false; old orders keep the name they were placed with. */
    private boolean active = true;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
