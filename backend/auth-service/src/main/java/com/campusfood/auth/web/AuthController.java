package com.campusfood.auth.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.auth.common.AuditService;
import com.campusfood.auth.common.CurrentUser;
import com.campusfood.auth.security.JwtService;
import com.campusfood.auth.user.User;
import com.campusfood.auth.user.UserDto;
import com.campusfood.auth.user.UserService;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Register, login and token refresh")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;
    private final AuditService audit;

    public AuthController(UserService userService, JwtService jwtService, AuditService audit) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.audit = audit;
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 80) String name,
            @NotBlank @Email @Size(max = 120) String email,
            @Pattern(regexp = "^$|^[0-9]{10}$", message = "must be 10 digits") String phone,
            @NotBlank @Size(min = 6, max = 64) String password) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 6, max = 64) String newPassword) {
    }

    public record AuthResponse(String token, long expiresInSeconds, UserDto user) {
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        User u = userService.registerStudent(req.name(), req.email(), req.phone(), req.password());
        return response(u);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return response(userService.login(req.email(), req.password()));
    }

    /** Hidden admin login – not shown in Swagger and not linked from any page. */
    @Hidden
    @PostMapping("/ops/login")
    public AuthResponse adminLogin(@Valid @RequestBody LoginRequest req) {
        User admin = userService.adminLogin(req.email(), req.password());
        audit.record(new CurrentUser(admin.getId(), "ADMIN", admin.getName(), null), "ADMIN_LOGIN", "Admin signed in");
        return response(admin);
    }

    @GetMapping("/me")
    public UserDto me(HttpServletRequest request) {
        return UserDto.of(userService.get(CurrentUser.from(request).id()));
    }

    /** Issues a fresh token so a long session never logs the user out mid-order. */
    @PostMapping("/refresh")
    public AuthResponse refresh(HttpServletRequest request) {
        User u = userService.get(CurrentUser.from(request).id());
        userService.ensureNotBlocked(u);
        return response(u);
    }

    @PostMapping("/change-password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req, HttpServletRequest request) {
        userService.changePassword(CurrentUser.from(request).id(), req.currentPassword(), req.newPassword());
    }

    private AuthResponse response(User u) {
        return new AuthResponse(jwtService.createToken(u), jwtService.validitySeconds(), UserDto.of(u));
    }
}
