package com.campusfood.restaurant.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DishRepository extends JpaRepository<Dish, Long> {

    List<Dish> findByRestaurantIdAndDeletedFalseOrderByCategoryAscNameAsc(Long restaurantId);

    Optional<Dish> findByIdAndRestaurantIdAndDeletedFalse(Long id, Long restaurantId);

    List<Dish> findByIdInAndDeletedFalse(Collection<Long> ids);

    /** Today's menu: available today and not sold out. */
    @Query("""
            select d from Dish d
            where d.restaurantId = :restaurantId and d.deleted = false
              and d.availableDate = :today and (d.stockLeft is null or d.stockLeft > 0)
            order by d.special desc, d.category asc, d.name asc
            """)
    List<Dish> findMenu(@Param("restaurantId") Long restaurantId, @Param("today") LocalDate today);

    @Query("""
            select d.restaurantId, count(d) from Dish d
            where d.deleted = false and d.availableDate = :today and (d.stockLeft is null or d.stockLeft > 0)
            group by d.restaurantId
            """)
    List<Object[]> countMenuByRestaurant(@Param("today") LocalDate today);

    /** Search dishes on today's menus across all restaurants. */
    @Query("""
            select d from Dish d
            where d.deleted = false and d.availableDate = :today and (d.stockLeft is null or d.stockLeft > 0)
              and (lower(d.name) like lower(concat('%', :q, '%')) or lower(d.category) like lower(concat('%', :q, '%')))
            order by d.soldCount desc
            """)
    List<Dish> searchToday(@Param("q") String q, @Param("today") LocalDate today);

    @Query("select max(d.availableDate) from Dish d where d.restaurantId = :rid and d.deleted = false and d.availableDate < :today")
    LocalDate lastMenuDateBefore(@Param("rid") Long restaurantId, @Param("today") LocalDate today);

    List<Dish> findByRestaurantIdAndAvailableDateAndDeletedFalse(Long restaurantId, LocalDate date);

    /**
     * Atomic stock reservation: succeeds only if enough plates are left.
     * Two students ordering the last plate at the same moment -> exactly one update succeeds.
     */
    @Modifying
    @Query("""
            update Dish d set d.stockLeft = d.stockLeft - :qty, d.soldCount = d.soldCount + :qty
            where d.id = :id and d.stockLeft is not null and d.stockLeft >= :qty
            """)
    int reserveLimited(@Param("id") Long id, @Param("qty") int qty);

    @Modifying
    @Query("update Dish d set d.soldCount = d.soldCount + :qty where d.id = :id and d.stockLeft is null")
    int reserveUnlimited(@Param("id") Long id, @Param("qty") int qty);

    /** Gives plates back when an order is cancelled or rejected (only for today's stock). */
    @Modifying
    @Query("""
            update Dish d set d.stockLeft = case when d.stockLeft is null then null else d.stockLeft + :qty end,
                              d.soldCount = case when d.soldCount >= :qty then d.soldCount - :qty else 0 end
            where d.id = :id and d.availableDate = :today
            """)
    int release(@Param("id") Long id, @Param("qty") int qty, @Param("today") LocalDate today);

    @Modifying
    @Query("update Dish d set d.ratingSum = d.ratingSum + :stars, d.ratingCount = d.ratingCount + 1 where d.id = :id")
    int addRating(@Param("id") Long id, @Param("stars") int stars);
}
