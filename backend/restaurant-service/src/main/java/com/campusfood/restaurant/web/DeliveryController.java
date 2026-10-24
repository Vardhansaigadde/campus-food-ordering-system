package com.campusfood.restaurant.web;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.common.AuditService;
import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.service.DeliveryService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Faculty delivery: buildings (admin), each canteen's delivery settings (owner) and the order check. */
@Hidden
@RestController
public class DeliveryController {

    private final DeliveryService delivery;
    private final AuditService audit;

    public DeliveryController(DeliveryService delivery, AuditService audit) {
        this.delivery = delivery;
        this.audit = audit;
    }

    public record LocationRequest(@NotBlank @Size(max = 60) String name, Boolean active) {
    }

    public record SettingsRequest(boolean enabled,
                                  @DecimalMin("0") @DecimalMax("500") BigDecimal fee,
                                  @DecimalMin("0") @DecimalMax("5000") BigDecimal minOrder,
                                  @Size(max = 6) List<String> runs,
                                  @Min(0) @Max(240) Integer cutoffMinutes,
                                  @Size(max = 100) List<Long> locationIds) {
    }

    public record QuoteRequest(@NotNull Long locationId, @NotBlank String run) {
    }

    // ---------------------------------------------------------------- everyone logged in

    /** Buildings to choose from (faculty request form, checkout, canteen settings). */
    @GetMapping("/api/locations")
    public List<DeliveryService.Location> locations() {
        return delivery.activeLocations();
    }

    // ---------------------------------------------------------------- admin

    @GetMapping("/api/admin/locations")
    public List<DeliveryService.Location> allLocations(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return delivery.allLocations();
    }

    @PostMapping("/api/admin/locations")
    @ResponseStatus(HttpStatus.CREATED)
    public DeliveryService.Location addLocation(@Valid @RequestBody LocationRequest body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        DeliveryService.Location l = delivery.addLocation(body.name());
        audit.record(admin, "DELIVERY_PLACE_ADDED", l.name());
        return l;
    }

    @PutMapping("/api/admin/locations/{id}")
    public DeliveryService.Location updateLocation(@PathVariable Long id, @Valid @RequestBody LocationRequest body,
                                                   HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        DeliveryService.Location l = delivery.updateLocation(id, body.name(), body.active() == null || body.active());
        audit.record(admin, "DELIVERY_PLACE_UPDATED", l.name() + (l.active() ? "" : " (hidden)"));
        return l;
    }

    // ---------------------------------------------------------------- canteen owner

    @GetMapping("/api/restaurant/delivery")
    public DeliveryService.Settings settings(HttpServletRequest request) {
        return delivery.settings(CurrentUser.from(request).requireRestaurantId());
    }

    @PutMapping("/api/restaurant/delivery")
    public DeliveryService.Settings saveSettings(@Valid @RequestBody SettingsRequest body, HttpServletRequest request) {
        CurrentUser user = CurrentUser.from(request);
        DeliveryService.Settings saved = delivery.saveSettings(user.requireRestaurantId(), new DeliveryService.Settings(
                body.enabled(), body.fee(), body.minOrder(), body.runs(), body.cutoffMinutes(), body.locationIds()));
        audit.record(user, "DELIVERY_SETTINGS", (saved.enabled() ? "on" : "off") + " · runs " + saved.runs()
                + " · fee ₹" + saved.fee());
        return saved;
    }

    // ---------------------------------------------------------------- Order Service

    @PostMapping("/internal/restaurants/{id}/delivery-quote")
    public DeliveryService.Quote quote(@PathVariable Long id, @Valid @RequestBody QuoteRequest body) {
        return delivery.quote(id, body.locationId(), body.run());
    }
}
