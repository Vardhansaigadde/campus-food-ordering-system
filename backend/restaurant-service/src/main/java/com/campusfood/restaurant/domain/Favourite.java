package com.campusfood.restaurant.domain;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "favourites", uniqueConstraints = @UniqueConstraint(columnNames = {"userId", "dishId"}))
@Getter
@Setter
@NoArgsConstructor
public class Favourite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long dishId;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Favourite(Long userId, Long dishId) {
        this.userId = userId;
        this.dishId = dishId;
    }
}
