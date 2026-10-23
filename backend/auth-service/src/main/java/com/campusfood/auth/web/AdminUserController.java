package com.campusfood.auth.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.auth.common.AuditService;
import com.campusfood.auth.common.CurrentUser;
import com.campusfood.auth.common.PageResponse;
import com.campusfood.auth.user.Role;
import com.campusfood.auth.user.UserDto;
import com.campusfood.auth.user.UserService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Admin-only user management. Hidden from Swagger; non-admins get 404. */
@Hidden
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserService userService;
    private final AuditService audit;

    public AdminUserController(UserService userService, AuditService audit) {
        this.userService = userService;
        this.audit = audit;
    }

    public record BlockRequest(boolean blocked) {
    }

    public record PasswordRequest(@NotBlank @Size(min = 6, max = 64) String password) {
    }

    @GetMapping
    public PageResponse<UserDto> list(@RequestParam(required = false) Role role,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return userService.search(role, q, page, size);
    }

    @GetMapping("/stats")
    public UserService.UserStats stats(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return userService.stats();
    }

    @GetMapping("/no-shows")
    public List<UserDto> noShows(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return userService.noShowList();
    }

    @GetMapping("/restaurant/{restaurantId}")
    public List<UserDto> restaurantLogins(@PathVariable Long restaurantId, HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return userService.restaurantLogins(restaurantId);
    }

    @PatchMapping("/{id}/block")
    public UserDto block(@PathVariable Long id, @RequestBody BlockRequest body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        UserDto u = userService.setBlocked(id, body.blocked());
        audit.record(admin, body.blocked() ? "USER_BLOCKED" : "USER_UNBLOCKED", u.name() + " (" + u.email() + ")");
        return u;
    }

    @PostMapping("/{id}/clear-ban")
    public UserDto clearBan(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        UserDto u = userService.clearOrderBan(id);
        audit.record(admin, "ORDER_BAN_CLEARED", u.name() + " (" + u.email() + ")");
        return u;
    }

    @PostMapping("/{id}/reset-password")
    public void resetPassword(@PathVariable Long id, @Valid @RequestBody PasswordRequest body,
                              HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        userService.resetPassword(id, body.password());
        audit.record(admin, "PASSWORD_RESET", "User #" + id);
    }
}
