package com.campusfood.auth.common;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/** Best-effort live events / push alerts – a notification problem never fails the request. */
@Component
public class Notices {

    private static final Logger log = LoggerFactory.getLogger(Notices.class);

    private final NotificationClient client;

    public Notices(NotificationClient client) {
        this.client = client;
    }

    @Async
    public void toUser(Long userId, String type, String title, String message) {
        send(List.of("user:" + userId), type, title, message);
    }

    @Async
    public void toAdmin(String type, String title, String message) {
        send(List.of("admin"), type, title, message);
    }

    private void send(List<String> channels, String type, String title, String message) {
        try {
            client.notify(new NotificationClient.Event(channels, type, title, message, Map.of()));
        } catch (Exception e) {
            log.debug("Notification not delivered: {}", e.getMessage());
        }
    }
}
