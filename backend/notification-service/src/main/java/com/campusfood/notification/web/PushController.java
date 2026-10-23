package com.campusfood.notification.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.notification.common.CurrentUser;
import com.campusfood.notification.push.PushService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@Tag(name = "Push alerts (phone locked / app closed)")
public class PushController {

    private final PushService push;

    public PushController(PushService push) {
        this.push = push;
    }

    @GetMapping("/api/notifications/push/key")
    @Operation(summary = "The server's public push key, needed by the browser to subscribe")
    public Map<String, String> key(HttpServletRequest request) {
        CurrentUser.from(request);
        return Map.of("publicKey", push.publicKey());
    }

    public record Keys(@NotBlank @Size(max = 120) String p256dh, @NotBlank @Size(max = 60) String auth) {
    }

    /** Same shape as the browser's PushSubscription.toJSON(). */
    public record Subscription(@NotBlank @Size(max = 700) String endpoint, @NotNull @Valid Keys keys) {
    }

    @PostMapping("/api/notifications/push/subscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Register this phone for alerts while the app is closed")
    public void subscribe(HttpServletRequest request, @Valid @RequestBody Subscription body) {
        push.subscribe(CurrentUser.from(request), body.endpoint(), body.keys().p256dh(), body.keys().auth());
    }

    public record Endpoint(@NotBlank @Size(max = 700) String endpoint) {
    }

    @PostMapping("/api/notifications/push/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Stop alerts on this phone (called on logout)")
    public void unsubscribe(HttpServletRequest request, @Valid @RequestBody Endpoint body) {
        push.unsubscribe(CurrentUser.from(request), body.endpoint());
    }
}
