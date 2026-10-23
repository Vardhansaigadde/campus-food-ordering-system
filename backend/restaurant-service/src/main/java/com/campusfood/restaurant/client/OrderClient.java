package com.campusfood.restaurant.client;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** Feign client for the Order Service (located through Eureka). */
@FeignClient(name = "order-service")
public interface OrderClient {

    @GetMapping("/internal/orders/day-summary")
    DaySummary daySummary(@RequestParam("restaurantId") Long restaurantId,
                          @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date);

    /** Only the fields the evening summary needs. */
    record DaySummary(LocalDate date, long totalOrders, Map<String, Long> byStatus, BigDecimal expectedCash) {
    }
}
