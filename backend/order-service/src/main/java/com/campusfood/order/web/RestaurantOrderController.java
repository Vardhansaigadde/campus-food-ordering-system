package com.campusfood.order.web;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.order.common.AuditService;
import com.campusfood.order.common.CurrentUser;
import com.campusfood.order.common.PageResponse;
import com.campusfood.order.domain.OrderStatus;
import com.campusfood.order.dto.OrderView;
import com.campusfood.order.dto.Requests;
import com.campusfood.order.service.OrderQueryService;
import com.campusfood.order.service.OrderWorkflowService;
import com.campusfood.order.service.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** Restaurant staff: live order board, status updates and Order ID + OTP verification. Own restaurant only. */
@RestController
@RequestMapping("/api/restaurant/orders")
@Tag(name = "Orders (restaurant staff)")
public class RestaurantOrderController {

    private final OrderQueryService queries;
    private final OrderWorkflowService workflow;
    private final ReportService reports;
    private final AuditService audit;

    public RestaurantOrderController(OrderQueryService queries, OrderWorkflowService workflow, ReportService reports,
                                     AuditService audit) {
        this.queries = queries;
        this.workflow = workflow;
        this.reports = reports;
        this.audit = audit;
    }

    @GetMapping("/active")
    @Operation(summary = "Live board: Placed, Preparing and Ready orders (pre-orders sorted by pickup time)")
    public List<OrderView> active(HttpServletRequest request) {
        return queries.activeForRestaurant(CurrentUser.from(request).requireRestaurantId());
    }

    @GetMapping
    @Operation(summary = "Order history for a day")
    public PageResponse<OrderView> history(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        return queries.historyForRestaurant(CurrentUser.from(request).requireRestaurantId(), date, status, page, size);
    }

    @GetMapping("/summary")
    @Operation(summary = "End-of-day summary: orders by status, expected cash, top dishes")
    public ReportService.DaySummary summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        return reports.daySummary(CurrentUser.from(request).requireRestaurantId(), date);
    }

    @PostMapping("/{id}/accept")
    public OrderView accept(@PathVariable Long id, HttpServletRequest request) {
        return workflow.accept(CurrentUser.from(request).requireRestaurantId(), id);
    }

    @PostMapping("/{id}/ready")
    public OrderView ready(@PathVariable Long id, HttpServletRequest request) {
        return workflow.markReady(CurrentUser.from(request).requireRestaurantId(), id);
    }

    @PostMapping("/{id}/reject")
    public OrderView reject(@PathVariable Long id, @Valid @RequestBody Requests.Reject body,
                            HttpServletRequest request) {
        CurrentUser staff = CurrentUser.from(request);
        OrderView o = workflow.reject(staff.requireRestaurantId(), id, body.reason());
        audit.record(staff, "ORDER_REJECTED", o.token() + ": " + body.reason());
        return o;
    }

    /** The delivery person leaves: every order for that run goes "on the way". */
    @PostMapping("/deliveries/start")
    public List<OrderView> startRun(@Valid @RequestBody Requests.StartRun body, HttpServletRequest request) {
        CurrentUser staff = CurrentUser.from(request);
        List<OrderView> out = workflow.startRun(staff.requireRestaurantId(), body.run());
        audit.record(staff, "DELIVERY_RUN_STARTED", body.run() + " · " + out.size() + " orders");
        return out;
    }

    /** Nobody was in the room – the order becomes a counter pickup. */
    @PostMapping("/{id}/delivery-missed")
    public OrderView deliveryMissed(@PathVariable Long id, HttpServletRequest request) {
        return workflow.deliveryMissed(CurrentUser.from(request).requireRestaurantId(), id);
    }

    @PostMapping("/verify")
    @Operation(summary = "Verify the Order ID (token) + OTP the student tells at the counter, then mark Collected")
    public OrderView verify(@Valid @RequestBody Requests.Verify body, HttpServletRequest request) {
        return workflow.verify(CurrentUser.from(request).requireRestaurantId(), body.token(), body.otp());
    }

    @PostMapping("/verify-qr")
    @Operation(summary = "Verify by scanning the student's QR code")
    public OrderView verifyQr(@Valid @RequestBody Requests.VerifyQr body, HttpServletRequest request) {
        return workflow.verifyQr(CurrentUser.from(request).requireRestaurantId(), body.code());
    }
}
