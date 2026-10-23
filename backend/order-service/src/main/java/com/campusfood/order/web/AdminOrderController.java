package com.campusfood.order.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.order.common.AuditService;
import com.campusfood.order.common.CurrentUser;
import com.campusfood.order.common.PageResponse;
import com.campusfood.order.domain.OrderStatus;
import com.campusfood.order.dto.OrderView;
import com.campusfood.order.service.OrderQueryService;
import com.campusfood.order.service.OrderWorkflowService;
import com.campusfood.order.service.ReportService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Admin: every order, statistics and CSV export. Hidden from Swagger; non-admins get 404. */
@Hidden
@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    private final OrderQueryService queries;
    private final OrderWorkflowService workflow;
    private final ReportService reports;
    private final AuditService audit;

    public AdminOrderController(OrderQueryService queries, OrderWorkflowService workflow, ReportService reports,
                                AuditService audit) {
        this.queries = queries;
        this.workflow = workflow;
        this.reports = reports;
        this.audit = audit;
    }

    @GetMapping
    public PageResponse<OrderView> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long restaurantId,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return queries.search(from, to, restaurantId, status, q, page, size);
    }

    @GetMapping("/stats")
    public ReportService.AdminStats stats(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return reports.adminStats(date);
    }

    @GetMapping("/export")
    public void export(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                       @RequestParam(required = false) Long restaurantId,
                       HttpServletRequest request, HttpServletResponse response) throws IOException {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        LocalDate start = from == null ? LocalDate.now() : from;
        LocalDate end = to == null ? start : to;
        response.setContentType("text/csv");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setHeader("Content-Disposition", "attachment; filename=\"orders_" + start + "_to_" + end + ".csv\"");
        var writer = response.getWriter();
        writer.write('﻿'); // lets Excel detect UTF-8 (₹ and names display correctly)
        reports.exportCsv(start, end, restaurantId, writer);
        writer.flush();
        audit.record(admin, "ORDERS_EXPORTED", start + " to " + end);
    }

    @PostMapping("/{id}/unlock-otp")
    public OrderView unlock(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        OrderView o = workflow.unlockOtp(id);
        audit.record(admin, "OTP_UNLOCKED", o.token());
        return o;
    }
}
