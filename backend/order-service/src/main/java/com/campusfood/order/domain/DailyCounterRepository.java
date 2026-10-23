package com.campusfood.order.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyCounterRepository extends JpaRepository<DailyCounter, String> {

    /**
     * Atomic "next number" in a single MySQL statement – safe even when two copies of the
     * Order Service create orders for the same restaurant at the same moment.
     */
    @Modifying
    @Query(value = """
            insert into daily_counters (counter_key, counter_value) values (:k, last_insert_id(1))
            on duplicate key update counter_value = last_insert_id(counter_value + 1)
            """, nativeQuery = true)
    void increment(@Param("k") String key);

    @Query(value = "select last_insert_id()", nativeQuery = true)
    long lastValue();
}
