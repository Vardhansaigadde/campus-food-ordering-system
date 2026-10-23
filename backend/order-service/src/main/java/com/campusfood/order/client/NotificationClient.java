package com.campusfood.order.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Feign client for the Notification Service, which pushes live updates to browsers. */
@FeignClient(name = "notification-service", contextId = "notificationClient")
public interface NotificationClient {

    @PostMapping("/internal/notify")
    void notify(@RequestBody Event event);

    /**
     * @param channels e.g. "user:12", "restaurant:3", "admin"
     */
    record Event(List<String> channels, String type, String title, String message, Map<String, Object> data) {
    }
}
