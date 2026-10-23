package com.campusfood.restaurant.web;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.common.AuditService;
import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.dto.DishView;
import com.campusfood.restaurant.dto.Requests;
import com.campusfood.restaurant.dto.RestaurantView;
import com.campusfood.restaurant.service.CounterSaleService;
import com.campusfood.restaurant.service.MenuService;
import com.campusfood.restaurant.service.RestaurantService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Restaurant staff dashboard. The restaurant id always comes from the staff member's own token,
 * never from the URL, so a restaurant can only ever see and change its own data.
 */
@RestController
@RequestMapping("/api/restaurant")
@Tag(name = "Restaurant staff", description = "Own restaurant profile, status, full menu and daily availability")
public class StaffController {

    private final RestaurantService restaurantService;
    private final MenuService menuService;
    private final AuditService audit;
    private final CounterSaleService counterSales;

    public StaffController(RestaurantService restaurantService, MenuService menuService, AuditService audit,
                           CounterSaleService counterSales) {
        this.restaurantService = restaurantService;
        this.menuService = menuService;
        this.audit = audit;
        this.counterSales = counterSales;
    }

    @GetMapping("/profile")
    public RestaurantView profile(HttpServletRequest request) {
        Long rid = CurrentUser.from(request).requireRestaurantId();
        return restaurantService.view(restaurantService.getActive(rid));
    }

    @PutMapping("/profile")
    public RestaurantView updateProfile(@Valid @RequestBody Requests.UpdateProfile body, HttpServletRequest request) {
        Long rid = CurrentUser.from(request).requireRestaurantId();
        return restaurantService.view(restaurantService.updateProfile(rid, body));
    }

    @PatchMapping("/status")
    @Operation(summary = "Open / Busy (pause new orders for N minutes) / Closed")
    public RestaurantView status(@Valid @RequestBody Requests.ChangeStatus body, HttpServletRequest request) {
        CurrentUser user = CurrentUser.from(request);
        var r = restaurantService.changeStatus(user.requireRestaurantId(), body.status(), body.busyMinutes());
        audit.record(user, "RESTAURANT_STATUS", r.getName() + " -> " + body.status());
        return restaurantService.view(r);
    }

    // ---------------------------------------------------------------- full menu

    @GetMapping("/menu/dishes")
    public List<DishView> dishes(HttpServletRequest request) {
        return menuService.allDishes(CurrentUser.from(request).requireRestaurantId());
    }

    @PostMapping("/menu/dishes")
    @ResponseStatus(HttpStatus.CREATED)
    public DishView addDish(@Valid @RequestBody Requests.SaveDish body, HttpServletRequest request) {
        CurrentUser user = CurrentUser.from(request);
        DishView d = menuService.addDish(user.requireRestaurantId(), body);
        audit.record(user, "DISH_ADDED", d.name() + " ₹" + d.price());
        return d;
    }

    @PutMapping("/menu/dishes/{id}")
    public DishView updateDish(@PathVariable Long id, @Valid @RequestBody Requests.SaveDish body,
                               HttpServletRequest request) {
        CurrentUser user = CurrentUser.from(request);
        DishView d = menuService.updateDish(user.requireRestaurantId(), id, body);
        audit.record(user, "DISH_UPDATED", d.name() + " ₹" + d.price());
        return d;
    }

    @DeleteMapping("/menu/dishes/{id}")
    public void deleteDish(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser user = CurrentUser.from(request);
        menuService.deleteDish(user.requireRestaurantId(), id);
        audit.record(user, "DISH_DELETED", "Dish #" + id);
    }

    // ---------------------------------------------------------------- today's availability

    @PatchMapping("/menu/dishes/{id}/availability")
    @Operation(summary = "Mark a dish available / unavailable for today")
    public DishView availability(@PathVariable Long id, @Valid @RequestBody Requests.Availability body,
                                 HttpServletRequest request) {
        return menuService.setAvailability(CurrentUser.from(request).requireRestaurantId(), id, body);
    }

    @PatchMapping("/menu/dishes/{id}/stock")
    @Operation(summary = "Set plates left today (empty = no limit)")
    public DishView stock(@PathVariable Long id, @Valid @RequestBody Requests.Stock body, HttpServletRequest request) {
        return menuService.setStock(CurrentUser.from(request).requireRestaurantId(), id, body.stockLeft());
    }

    @PostMapping("/menu/all-availability")
    public Map<String, Integer> all(@RequestBody Requests.BulkAvailability body, HttpServletRequest request) {
        int n = menuService.setAllAvailability(CurrentUser.from(request).requireRestaurantId(), body.available());
        return Map.of("updated", n);
    }

    @PostMapping("/menu/copy-last-day")
    @Operation(summary = "Make today's menu the same as the last day's menu")
    public Map<String, Integer> copyLastDay(HttpServletRequest request) {
        return Map.of("updated", menuService.copyLastDay(CurrentUser.from(request).requireRestaurantId()));
    }

    // ---------------------------------------------------------------- walk-in counter sales

    @PostMapping("/menu/dishes/{id}/counter-sale")
    @Operation(summary = "Plates sold at the counter to a walk-in customer (taken from today's stock)")
    public CounterSaleService.Sold counterSale(@PathVariable Long id, @Valid @RequestBody Requests.CounterSale body,
                                               HttpServletRequest request) {
        return counterSales.sell(CurrentUser.from(request).requireRestaurantId(), id, body.quantity());
    }

    @DeleteMapping("/menu/counter-sales/{saleId}")
    @Operation(summary = "Undo a counter sale tapped by mistake (today only)")
    public DishView undoCounterSale(@PathVariable Long saleId, HttpServletRequest request) {
        return counterSales.undo(CurrentUser.from(request).requireRestaurantId(), saleId);
    }

    @GetMapping("/menu/counter-sales/summary")
    @Operation(summary = "Walk-in sales of one day, per dish")
    public CounterSaleService.Summary counterSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        return counterSales.summary(CurrentUser.from(request).requireRestaurantId(), date == null ? LocalDate.now() : date);
    }
}
