package com.campusfood.notification.push;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The server's own push identity (VAPID key pair), created once on first start and kept in the database,
 * so phones that subscribed stay subscribed across restarts and redeploys. Single row, id = 1.
 */
@Entity
@Table(name = "push_vapid_key")
@Getter
@Setter
@NoArgsConstructor
public class VapidKey {

    @Id
    private Long id = 1L;

    @Column(nullable = false, length = 120)
    private String publicKey;

    @Column(nullable = false, length = 80)
    private String privateKey;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
