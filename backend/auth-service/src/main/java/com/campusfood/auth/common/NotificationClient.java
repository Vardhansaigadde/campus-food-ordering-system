package com.campusfood.auth.common;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Sends live events (and phone push alerts) through the Notification Service. */
@FeignClient(name = "notification-service", contextId = "notificationClient")
public interface NotificationClient {

    @PostMapping("/internal/notify")
    void notify(@RequestBody Event event);

    record Event(List<String> channels, String type, String title, String message, Map<String, Object> data) {
    }
}
