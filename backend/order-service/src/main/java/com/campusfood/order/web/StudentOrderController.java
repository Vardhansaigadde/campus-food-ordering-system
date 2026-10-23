package com.campusfood.order.web;

import java.time.YearMonth;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.order.common.CurrentUser;
import com.campusfood.order.common.PageResponse;
import com.campusfood.order.dto.OrderView;
import com.campusfood.order.dto.Requests;
import com.campusfood.order.service.OrderPlacementService;
import com.campusfood.order.service.OrderQueryService;
import com.campusfood.order.service.OrderWorkflowService;
import com.campusfood.order.service.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders (student)", description = "Place, track, cancel and rate pickup orders")
public class StudentOrderController {

    private final OrderPlacementService placement;
    private final OrderQueryService queries;
    private final OrderWorkflowService workflow;
    private final ReportService reports;

    public StudentOrderController(OrderPlacementService placement, OrderQueryService queries,
                                  OrderWorkflowService workflow, ReportService reports) {
        this.placement = placement;
        this.queries = queries;
        this.workflow = workflow;
        this.reports = reports;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Place a pickup order – returns the Order ID (token), OTP and QR code")
    public OrderView place(@Valid @RequestBody Requests.PlaceOrder body,
                           @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                           HttpServletRequest request) {
        return placement.place(CurrentUser.from(request).requireStudent(), body, idempotencyKey);
    }

    @GetMapping("/my")
    @Operation(summary = "My orders: active=true for current orders, false for history")
    public PageResponse<OrderView> my(@RequestParam(defaultValue = "true") boolean active,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      HttpServletRequest request) {
        return queries.myOrders(CurrentUser.from(request).requireStudent().id(), active, page, size);
    }

    @GetMapping("/my/summary")
    @Operation(summary = "Monthly spending summary (month = yyyy-MM)")
    public ReportService.MonthSummary summary(@RequestParam(required = false) String month,
                                              HttpServletRequest request) {
        return reports.monthSummary(CurrentUser.from(request).requireStudent().id(),
                month == null || month.isBlank() ? null : YearMonth.parse(month));
    }

    @GetMapping("/{id}")
    @Operation(summary = "One of my orders, with live queue position and estimated time")
    public OrderView get(@PathVariable Long id, HttpServletRequest request) {
        return queries.forStudent(id, CurrentUser.from(request).requireStudent().id());
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel – only while the restaurant has not started the order")
    public OrderView cancel(@PathVariable Long id, HttpServletRequest request) {
        return workflow.cancelByStudent(CurrentUser.from(request).requireStudent().id(), id);
    }

    @PostMapping("/{id}/rate")
    @Operation(summary = "Rate a collected order (1-5 stars, optional per-dish stars and review)")
    public OrderView rate(@PathVariable Long id, @Valid @RequestBody Requests.Rate body, HttpServletRequest request) {
        return workflow.rate(CurrentUser.from(request).requireStudent().id(), id, body);
    }
}
