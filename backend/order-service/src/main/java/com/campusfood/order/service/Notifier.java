package com.campusfood.order.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import com.campusfood.order.client.NotificationClient;

/**
 * Sends live events to the Notification Service in the background.
 * If notifications are down, ordering still works – the pages simply refresh on their own.
 */
@Component
public class Notifier {

    private static final Logger log = LoggerFactory.getLogger(Notifier.class);

    private final NotificationClient client;

    public Notifier(NotificationClient client) {
        this.client = client;
    }

    public record OrderEvent(Long orderId, String token, Long restaurantId, Long studentId, String status) {
    }

    @Async
    public void toStudent(OrderEvent e, String type, String title, String message) {
        send(List.of("user:" + e.studentId()), type, title, message, e);
    }

    @Async
    public void toRestaurant(OrderEvent e, String type, String title, String message) {
        send(List.of("restaurant:" + e.restaurantId()), type, title, message, e);
    }

    @Async
    public void toBoth(OrderEvent e, String type, String title, String message) {
        send(List.of("user:" + e.studentId(), "restaurant:" + e.restaurantId()), type, title, message, e);
    }

    private void send(List<String> channels, String type, String title, String message, OrderEvent e) {
        try {
            client.notify(new NotificationClient.Event(channels, type, title, message, Map.of(
                    "orderId", e.orderId(),
                    "token", e.token(),
                    "restaurantId", e.restaurantId(),
                    "status", e.status())));
        } catch (Exception ex) {
            log.debug("Live notification not delivered: {}", ex.getMessage());
        }
    }
}
