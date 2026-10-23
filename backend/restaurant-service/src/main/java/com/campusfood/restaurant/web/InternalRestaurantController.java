package com.campusfood.restaurant.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.dto.Requests;
import com.campusfood.restaurant.dto.ReservationResult;
import com.campusfood.restaurant.dto.RestaurantView;
import com.campusfood.restaurant.service.RestaurantService;
import com.campusfood.restaurant.service.StockService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;

/** Service-to-service endpoints used by the Order Service via OpenFeign. */
@Hidden
@RestController
@RequestMapping("/internal")
public class InternalRestaurantController {

    private final StockService stockService;
    private final RestaurantService restaurantService;

    public InternalRestaurantController(StockService stockService, RestaurantService restaurantService) {
        this.stockService = stockService;
        this.restaurantService = restaurantService;
    }

    @GetMapping("/restaurants/{id}")
    public RestaurantView get(@PathVariable Long id) {
        return restaurantService.view(restaurantService.get(id));
    }

    @PostMapping("/restaurants/{id}/reserve")
    public ReservationResult reserve(@PathVariable Long id, @Valid @RequestBody Requests.Reserve body) {
        return stockService.reserve(id, body.items());
    }

    @PostMapping("/restaurants/{id}/release")
    public void release(@PathVariable Long id, @Valid @RequestBody Requests.Reserve body) {
        stockService.release(body.items());
    }

    @PostMapping("/ratings")
    public void rate(@Valid @RequestBody Requests.Ratings body) {
        stockService.rate(body);
    }
}
