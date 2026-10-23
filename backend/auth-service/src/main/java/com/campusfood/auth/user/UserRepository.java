package com.campusfood.auth.user;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByRole(Role role);

    long countByRole(Role role);

    long countByBlockedTrue();

    List<User> findByRestaurantId(Long restaurantId);

    @Query("""
            select u from User u
            where u.role <> com.campusfood.auth.user.Role.ADMIN
              and (:role is null or u.role = :role)
              and (:q is null or lower(u.name) like lower(concat('%', :q, '%'))
                              or lower(u.email) like lower(concat('%', :q, '%'))
                              or u.phone like concat('%', :q, '%'))
            order by u.createdAt desc
            """)
    Page<User> search(@Param("role") Role role, @Param("q") String q, Pageable pageable);

    @Query("""
            select u from User u
            where u.role = com.campusfood.auth.user.Role.STUDENT and u.totalNoShows > 0
            order by u.totalNoShows desc
            """)
    List<User> findWithNoShows();
}
