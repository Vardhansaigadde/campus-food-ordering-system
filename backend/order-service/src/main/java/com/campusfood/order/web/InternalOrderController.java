package com.campusfood.order.web;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.order.service.ReportService;

import io.swagger.v3.oas.annotations.Hidden;

/** Called by other microservices only (X-Internal-Key, checked by GatewayKeyFilter). */
@Hidden
@RestController
public class InternalOrderController {

    private final ReportService reports;

    public InternalOrderController(ReportService reports) {
        this.reports = reports;
    }

    /** App-order totals of one restaurant for one day – used for the owner's evening summary alert. */
    @GetMapping("/internal/orders/day-summary")
    public ReportService.DaySummary daySummary(@RequestParam Long restaurantId,
                                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return reports.daySummary(restaurantId, date);
    }
}
