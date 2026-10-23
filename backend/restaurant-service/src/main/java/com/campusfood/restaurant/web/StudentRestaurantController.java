package com.campusfood.restaurant.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.dto.DishView;
import com.campusfood.restaurant.dto.RestaurantView;
import com.campusfood.restaurant.service.MenuService;
import com.campusfood.restaurant.service.RestaurantService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/restaurants")
@Tag(name = "Restaurants (student)", description = "Browse restaurants and today's menus")
public class StudentRestaurantController {

    private final RestaurantService restaurantService;
    private final MenuService menuService;

    public StudentRestaurantController(RestaurantService restaurantService, MenuService menuService) {
        this.restaurantService = restaurantService;
        this.menuService = menuService;
    }

    public record RestaurantMenu(RestaurantView restaurant, List<DishView> dishes) {
    }

    @GetMapping
    @Operation(summary = "All campus restaurants with their Open / Busy / Closed status")
    public List<RestaurantView> list(HttpServletRequest request) {
        CurrentUser.from(request);
        return restaurantService.listForStudents();
    }

    @GetMapping("/{id}")
    @Operation(summary = "A restaurant with ONLY the dishes available today")
    public RestaurantMenu menu(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser.from(request);
        var r = restaurantService.getActive(id);
        return new RestaurantMenu(restaurantService.view(r), menuService.todaysMenu(id));
    }

    @GetMapping("/search")
    @Operation(summary = "Search today's dishes across all restaurants")
    public List<DishView> search(@RequestParam String q, HttpServletRequest request) {
        CurrentUser.from(request);
        return menuService.searchToday(q);
    }
}
