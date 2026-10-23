package com.campusfood.order.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Per-restaurant, per-day token counter (key "restaurantId:yyyy-MM-dd"). */
@Entity
@Table(name = "daily_counters")
@Getter
@Setter
@NoArgsConstructor
public class DailyCounter {

    @Id
    @Column(length = 40)
    private String counterKey;

    private int counterValue;
}
