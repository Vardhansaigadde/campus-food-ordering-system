package com.campusfood.notification.domain;

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

/** "Who changed what, and when" – collected from all microservices. */
@Entity
@Table(name = "audit_log", indexes = @Index(name = "idx_audit_created", columnList = "createdAt"))
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long actorId;

    @Column(length = 80)
    private String actorName;

    @Column(length = 12)
    private String actorRole;

    @Column(nullable = false, length = 40)
    private String action;

    @Column(length = 400)
    private String details;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
