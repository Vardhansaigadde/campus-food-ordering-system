package com.campusfood.notification.domain;

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

/** Banner shown on every page, e.g. "All canteens closed on Friday". */
@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String message;

    /** INFO, WARNING or SUCCESS – controls the banner colour. */
    @Column(nullable = false, length = 10)
    private String level = "INFO";

    private boolean active = true;

    /** Banner disappears automatically after this time (optional). */
    private LocalDateTime expiresAt;

    @Column(length = 80)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public boolean isVisible() {
        return active && (expiresAt == null || expiresAt.isAfter(LocalDateTime.now()));
    }
}
