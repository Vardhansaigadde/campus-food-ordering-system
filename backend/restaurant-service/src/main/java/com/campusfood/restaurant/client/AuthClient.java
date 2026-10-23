package com.campusfood.restaurant.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Feign client for the Auth Service – found through Eureka by its name. */
@FeignClient(name = "auth-service")
public interface AuthClient {

    @PostMapping("/internal/users/restaurant-login")
    void createRestaurantLogin(@RequestBody RestaurantLogin login);

    @PostMapping("/internal/users/restaurant/{restaurantId}/block")
    void blockRestaurantLogins(@PathVariable("restaurantId") Long restaurantId, @RequestBody Block block);

    record RestaurantLogin(Long restaurantId, String name, String email, String password) {
    }

    record Block(boolean blocked) {
    }
}
