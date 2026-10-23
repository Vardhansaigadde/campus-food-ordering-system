package com.campusfood.restaurant.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CounterSaleRepository extends JpaRepository<CounterSale, Long> {

    Optional<CounterSale> findByIdAndRestaurantId(Long id, Long restaurantId);

    /** Per dish for one day: name, plates, amount. */
    @Query("""
            select s.dishName, sum(s.quantity), sum(s.unitPrice * s.quantity) from CounterSale s
            where s.restaurantId = :rid and s.saleDate = :day
            group by s.dishName order by sum(s.quantity) desc
            """)
    List<Object[]> summary(@Param("rid") Long restaurantId, @Param("day") LocalDate day);
}
