package com.campusfood.notification.web;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.campusfood.notification.common.CurrentUser;
import com.campusfood.notification.live.LiveHub;
import com.campusfood.notification.push.PushService;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

@RestController
@Tag(name = "Live notifications")
public class LiveController {

    private final LiveHub hub;
    private final PushService push;

    public LiveController(LiveHub hub, PushService push) {
        this.hub = hub;
        this.push = push;
    }

    @GetMapping(path = "/api/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Server-Sent Events stream of live updates for the logged-in user")
    public SseEmitter stream(HttpServletRequest request) {
        return hub.subscribe(CurrentUser.from(request));
    }

    public record Event(@NotEmpty List<String> channels, @NotBlank String type, String title, String message,
                        Map<String, Object> data) {
    }

    /** Called by the other microservices (Feign) to push an event to browsers and phones. */
    @Hidden
    @PostMapping("/internal/notify")
    public Map<String, Integer> notify(@RequestBody Event event) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", event.type());
        payload.put("title", event.title());
        payload.put("message", event.message());
        payload.put("data", event.data() == null ? Map.of() : event.data());
        // Open screens get it live; important events also wake locked phones
        push.sendAsync(event.channels(), event.type(), event.title(), event.message(), event.data());
        return Map.of("delivered", hub.publish(event.channels(), payload));
    }
}
