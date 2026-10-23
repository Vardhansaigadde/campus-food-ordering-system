package com.campusfood.restaurant.web;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.common.AuditService;
import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.dto.DishView;
import com.campusfood.restaurant.dto.Requests;
import com.campusfood.restaurant.dto.RestaurantView;
import com.campusfood.restaurant.service.MenuService;
import com.campusfood.restaurant.service.RestaurantService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** Admin: manage every restaurant and, if needed, any restaurant's dishes. Hidden from Swagger. */
@Hidden
@RestController
@RequestMapping("/api/admin/restaurants")
public class AdminRestaurantController {

    private final RestaurantService restaurantService;
    private final MenuService menuService;
    private final AuditService audit;

    public AdminRestaurantController(RestaurantService restaurantService, MenuService menuService, AuditService audit) {
        this.restaurantService = restaurantService;
        this.menuService = menuService;
        this.audit = audit;
    }

    @GetMapping
    public List<RestaurantView> list(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return restaurantService.listForAdmin();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantView create(@Valid @RequestBody Requests.CreateRestaurant body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        var r = restaurantService.create(body);
        audit.record(admin, "RESTAURANT_CREATED", r.getName() + " (" + r.getCode() + "), login " + body.loginEmail());
        return restaurantService.view(r);
    }

    @PutMapping("/{id}")
    public RestaurantView update(@PathVariable Long id, @Valid @RequestBody Requests.UpdateRestaurant body,
                                 HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        var r = restaurantService.update(id, body);
        audit.record(admin, "RESTAURANT_UPDATED", r.getName());
        return restaurantService.view(r);
    }

    @PatchMapping("/{id}/status")
    public RestaurantView status(@PathVariable Long id, @Valid @RequestBody Requests.ChangeStatus body,
                                 HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        var r = restaurantService.changeStatus(id, body.status(), body.busyMinutes());
        audit.record(admin, "RESTAURANT_STATUS", r.getName() + " -> " + body.status());
        return restaurantService.view(r);
    }

    @DeleteMapping("/{id}")
    public RestaurantView remove(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        var r = restaurantService.setActive(id, false);
        audit.record(admin, "RESTAURANT_REMOVED", r.getName());
        return restaurantService.view(r);
    }

    @PostMapping("/{id}/restore")
    public RestaurantView restore(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        var r = restaurantService.setActive(id, true);
        audit.record(admin, "RESTAURANT_RESTORED", r.getName());
        return restaurantService.view(r);
    }

    @PostMapping("/{id}/logins")
    public void addLogin(@PathVariable Long id, @Valid @RequestBody Requests.AddLogin body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        restaurantService.addLogin(id, body);
        audit.record(admin, "RESTAURANT_LOGIN_ADDED", "Restaurant #" + id + ": " + body.email());
    }

    // ---------------------------------------------------------------- dishes on behalf of a restaurant

    @GetMapping("/{id}/dishes")
    public List<DishView> dishes(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        restaurantService.get(id);
        return menuService.allDishes(id);
    }

    @PostMapping("/{id}/dishes")
    @ResponseStatus(HttpStatus.CREATED)
    public DishView addDish(@PathVariable Long id, @Valid @RequestBody Requests.SaveDish body,
                            HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        restaurantService.get(id);
        DishView d = menuService.addDish(id, body);
        audit.record(admin, "DISH_ADDED", "Restaurant #" + id + ": " + d.name());
        return d;
    }

    @PutMapping("/{id}/dishes/{dishId}")
    public DishView updateDish(@PathVariable Long id, @PathVariable Long dishId,
                               @Valid @RequestBody Requests.SaveDish body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        DishView d = menuService.updateDish(id, dishId, body);
        audit.record(admin, "DISH_UPDATED", "Restaurant #" + id + ": " + d.name());
        return d;
    }

    @DeleteMapping("/{id}/dishes/{dishId}")
    public void deleteDish(@PathVariable Long id, @PathVariable Long dishId, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        menuService.deleteDish(id, dishId);
        audit.record(admin, "DISH_DELETED", "Restaurant #" + id + ": dish #" + dishId);
    }

    @PatchMapping("/{id}/dishes/{dishId}/availability")
    public DishView availability(@PathVariable Long id, @PathVariable Long dishId,
                                 @Valid @RequestBody Requests.Availability body, HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return menuService.setAvailability(id, dishId, body);
    }

    @PostMapping("/{id}/all-availability")
    public Map<String, Integer> all(@PathVariable Long id, @RequestBody Requests.BulkAvailability body,
                                    HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return Map.of("updated", menuService.setAllAvailability(id, body.available()));
    }
}
