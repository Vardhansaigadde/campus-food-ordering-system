package com.campusfood.restaurant.domain;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    List<Restaurant> findByActiveTrueOrderByNameAsc();

    List<Restaurant> findAllByOrderByActiveDescNameAsc();

    boolean existsByCode(String code);

    List<Restaurant> findByActiveTrueAndStatusNot(RestaurantStatus status);

    // Targeted updates for the daily routine: they touch only their own columns, so they can never
    // undo a status change made at the same moment by the owner or the auto-close job.

    /** Morning auto-open: opens only if still CLOSED, and only once per day. */
    @Modifying
    @Transactional
    @Query("""
            update Restaurant r set r.lastAutoOpenedOn = :today,
                   r.status = case when r.status = com.campusfood.restaurant.domain.RestaurantStatus.CLOSED
                                   then com.campusfood.restaurant.domain.RestaurantStatus.OPEN else r.status end
            where r.id = :id and (r.lastAutoOpenedOn is null or r.lastAutoOpenedOn <> :today)
            """)
    int markAutoOpened(@Param("id") Long id, @Param("today") LocalDate today);

    @Modifying
    @Transactional
    @Query("""
            update Restaurant r set r.lastSummaryOn = :today
            where r.id = :id and (r.lastSummaryOn is null or r.lastSummaryOn <> :today)
            """)
    int markSummarySent(@Param("id") Long id, @Param("today") LocalDate today);
}
