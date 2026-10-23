package com.campusfood.order.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByIdempotencyKey(String key);

    long countByStudentIdAndStatusIn(Long studentId, Collection<OrderStatus> statuses);

    Optional<Order> findByRestaurantIdAndTokenDateAndToken(Long restaurantId, LocalDate tokenDate, String token);

    // ---------------------------------------------------------------- student

    Page<Order> findByStudentIdAndStatusInOrderByCreatedAtDesc(Long studentId, Collection<OrderStatus> statuses,
                                                               Pageable pageable);

    List<Order> findByStudentIdAndStatusAndCollectedAtBetween(Long studentId, OrderStatus status,
                                                              LocalDateTime from, LocalDateTime to);

    // ---------------------------------------------------------------- restaurant

    @Query("""
            select o from FoodOrder o
            where o.restaurantId = :rid and o.status in :statuses
            order by coalesce(o.pickupTime, o.createdAt) asc
            """)
    List<Order> findActiveForRestaurant(@Param("rid") Long restaurantId,
                                        @Param("statuses") Collection<OrderStatus> statuses);

    @Query("""
            select o from FoodOrder o
            where o.restaurantId = :rid and o.createdAt >= :from and o.createdAt < :to
              and (:status is null or o.status = :status)
            order by o.createdAt desc
            """)
    Page<Order> findForRestaurant(@Param("rid") Long restaurantId, @Param("from") LocalDateTime from,
                                  @Param("to") LocalDateTime to, @Param("status") OrderStatus status,
                                  Pageable pageable);

    /** Queue position: orders of the same restaurant still in the kitchen and due before this one. */
    @Query("""
            select count(o) from FoodOrder o
            where o.restaurantId = :rid and o.status in :statuses and o.id <> :id
              and (coalesce(o.pickupTime, o.createdAt) < :time
                   or (coalesce(o.pickupTime, o.createdAt) = :time and o.id < :id))
            """)
    long countAhead(@Param("rid") Long restaurantId, @Param("statuses") Collection<OrderStatus> statuses,
                    @Param("id") Long id, @Param("time") LocalDateTime time);

    @Query("""
            select o.readyAt from FoodOrder o
            where o.restaurantId = :rid and o.readyAt is not null and o.readyAt >= :since
            order by o.readyAt desc
            """)
    List<LocalDateTime> recentReadyTimes(@Param("rid") Long restaurantId, @Param("since") LocalDateTime since,
                                         Pageable pageable);

    // ---------------------------------------------------------------- admin

    @Query("""
            select o from FoodOrder o
            where o.createdAt >= :from and o.createdAt < :to
              and (:rid is null or o.restaurantId = :rid)
              and (:status is null or o.status = :status)
              and (:q is null or o.token like concat('%', :q, '%') or lower(o.studentName) like lower(concat('%', :q, '%')))
            order by o.createdAt desc
            """)
    Page<Order> search(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                       @Param("rid") Long restaurantId, @Param("status") OrderStatus status,
                       @Param("q") String q, Pageable pageable);

    // ---------------------------------------------------------------- statistics

    @Query("""
            select count(o) from FoodOrder o
            where o.createdAt >= :from and o.createdAt < :to and (:rid is null or o.restaurantId = :rid)
            """)
    long countCreated(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to, @Param("rid") Long rid);

    @Query("""
            select o.status, count(o) from FoodOrder o
            where o.createdAt >= :from and o.createdAt < :to and (:rid is null or o.restaurantId = :rid)
            group by o.status
            """)
    List<Object[]> countByStatus(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                 @Param("rid") Long rid);

    /** Cash actually collected = total of orders handed over in the period. */
    @Query("""
            select coalesce(sum(o.total), 0) from FoodOrder o
            where o.status = com.campusfood.order.domain.OrderStatus.COLLECTED
              and o.collectedAt >= :from and o.collectedAt < :to and (:rid is null or o.restaurantId = :rid)
            """)
    BigDecimal collectedRevenue(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                @Param("rid") Long rid);

    @Query("""
            select extract(hour from o.createdAt), count(o) from FoodOrder o
            where o.createdAt >= :from and o.createdAt < :to and (:rid is null or o.restaurantId = :rid)
            group by extract(hour from o.createdAt)
            """)
    List<Object[]> ordersByHour(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                                @Param("rid") Long rid);

    @Query("""
            select o.restaurantId, o.restaurantName, count(o),
                   coalesce(sum(case when o.status = com.campusfood.order.domain.OrderStatus.COLLECTED then o.total else 0 end), 0)
            from FoodOrder o
            where o.createdAt >= :from and o.createdAt < :to
            group by o.restaurantId, o.restaurantName
            order by count(o) desc
            """)
    List<Object[]> byRestaurant(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select i.name, sum(i.quantity) from OrderItem i
            where i.order.createdAt >= :from and i.order.createdAt < :to
              and (:rid is null or i.order.restaurantId = :rid)
              and i.order.status not in (com.campusfood.order.domain.OrderStatus.CANCELLED,
                                         com.campusfood.order.domain.OrderStatus.REJECTED)
            group by i.dishId, i.name
            order by sum(i.quantity) desc
            """)
    List<Object[]> topDishes(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
                             @Param("rid") Long rid, Pageable pageable);

    // ---------------------------------------------------------------- background jobs

    @Query("select o.id from FoodOrder o where o.status = com.campusfood.order.domain.OrderStatus.READY and o.readyAt < :before")
    List<Long> findUncollectedReadyIds(@Param("before") LocalDateTime before);

    @Query("""
            select o.id from FoodOrder o
            where o.status in :statuses and coalesce(o.pickupTime, o.createdAt) < :before
            """)
    List<Long> findStaleIds(@Param("statuses") Collection<OrderStatus> statuses, @Param("before") LocalDateTime before);

    /**
     * Status change that only succeeds if the order is still in the expected status.
     * Prevents two staff tablets (or two Order Service copies) from processing the same order twice.
     */
    @Modifying
    @Query("""
            update FoodOrder o set o.status = :to, o.closedAt = :now, o.version = o.version + 1
            where o.id = :id and o.status in :from
            """)
    int transition(@Param("id") Long id, @Param("from") Collection<OrderStatus> from,
                   @Param("to") OrderStatus to, @Param("now") LocalDateTime now);
}
