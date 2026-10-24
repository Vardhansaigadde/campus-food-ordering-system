package com.campusfood.auth.user;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_role", columnList = "role"),
        @Index(name = "idx_users_restaurant", columnList = "restaurantId")
})
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    /** Login id. Stored lower-case. */
    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(length = 15)
    private String phone;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    /** Only for RESTAURANT accounts: the one restaurant this login belongs to. */
    private Long restaurantId;

    /** Blocked by the admin: cannot log in at all. */
    private boolean blocked;

    /** Temporary ordering ban after 3 no-shows. */
    private LocalDateTime orderBanUntil;

    /** No-shows since the last ban. */
    private int noShowCount;

    /** All-time no-shows, for the admin's no-show list. */
    private int totalNoShows;

    // ---------------------------------------------------------------- faculty delivery

    /** null on accounts created before faculty delivery existed – read through {@link #facultyStatus()}. */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(length = 12)
    private FacultyStatus facultyStatus;

    @Column(length = 60)
    private String department;

    /** Building the food is delivered to (a delivery place managed by the admin in the Restaurant Service). */
    private Long deliveryLocationId;

    @Column(length = 30)
    private String deliveryRoom;

    /** File name of the college ID photo while the request waits; deleted once the admin decides. */
    @Column(length = 40)
    private String facultyIdPhoto;

    /** Why the request was turned down, shown to the user. */
    @Column(length = 150)
    private String facultyNote;

    private LocalDateTime facultyRequestedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public FacultyStatus facultyStatus() {
        return facultyStatus == null ? FacultyStatus.NONE : facultyStatus;
    }

    public boolean isFaculty() {
        return facultyStatus() == FacultyStatus.APPROVED;
    }
}
