package com.campusfood.auth.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.auth.user.User;
import com.campusfood.auth.user.UserDto;
import com.campusfood.auth.user.UserService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Service-to-service endpoints (called with Feign by the other microservices, never by browsers). */
@Hidden
@RestController
@RequestMapping("/internal/users")
public class InternalUserController {

    private final UserService userService;

    public InternalUserController(UserService userService) {
        this.userService = userService;
    }

    public record RestaurantLoginRequest(@NotNull Long restaurantId,
                                         @NotBlank String name,
                                         @NotBlank @Email String email,
                                         @NotBlank @Size(min = 6, max = 64) String password) {
    }

    public record BlockRequest(boolean blocked) {
    }

    /** Called by the Restaurant Service when the admin adds a restaurant. */
    @PostMapping("/restaurant-login")
    public UserDto createRestaurantLogin(@Valid @RequestBody RestaurantLoginRequest req) {
        User u = userService.createRestaurantLogin(req.restaurantId(), req.name(), req.email(), req.password());
        return UserDto.of(u);
    }

    /** Called by the Restaurant Service when a restaurant is removed / restored. */
    @PostMapping("/restaurant/{restaurantId}/block")
    public void blockRestaurantLogins(@PathVariable Long restaurantId, @RequestBody BlockRequest req) {
        userService.setRestaurantLoginsBlocked(restaurantId, req.blocked());
    }

    /** Called by the Order Service before accepting an order. */
    @GetMapping("/{id}/order-eligibility")
    public UserService.Eligibility eligibility(@PathVariable Long id) {
        return userService.orderEligibility(id);
    }

    /** Called by the Order Service's no-show job. */
    @PostMapping("/{id}/no-show")
    public UserDto noShow(@PathVariable Long id) {
        return userService.recordNoShow(id);
    }
}
