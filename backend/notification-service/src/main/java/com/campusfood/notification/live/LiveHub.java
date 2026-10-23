package com.campusfood.notification.live;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.campusfood.notification.common.CurrentUser;

/**
 * Keeps one open Server-Sent Events connection per browser tab and pushes events to "channels":
 * <ul>
 *   <li>{@code user:12}       – one student (order ready, rejected…)</li>
 *   <li>{@code restaurant:3}  – every staff screen of one restaurant (new order ping)</li>
 *   <li>{@code admin}         – the admin dashboard</li>
 *   <li>{@code all}           – everyone (announcements)</li>
 * </ul>
 * One push replaces thousands of "is my order ready yet?" polling requests during the lunch rush.
 */
@Component
public class LiveHub {

    private static final Logger log = LoggerFactory.getLogger(LiveHub.class);
    private static final long TIMEOUT_MS = 30 * 60_000L;

    private final Map<String, Set<SseEmitter>> channels = new ConcurrentHashMap<>();

    public SseEmitter subscribe(CurrentUser user) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        List<String> mine = channelsFor(user);
        mine.forEach(c -> channels.computeIfAbsent(c, k -> new CopyOnWriteArraySet<>()).add(emitter));
        Runnable remove = () -> mine.forEach(c -> {
            Set<SseEmitter> set = channels.get(c);
            if (set != null) {
                set.remove(emitter);
            }
        });
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        send(emitter, "connected", Map.of("channels", mine, "at", LocalDateTime.now().toString()));
        return emitter;
    }

    public int publish(List<String> targetChannels, Map<String, Object> payload) {
        int delivered = 0;
        for (String channel : targetChannels) {
            for (SseEmitter emitter : channels.getOrDefault(channel, Set.of())) {
                if (send(emitter, "notification", payload)) {
                    delivered++;
                }
            }
        }
        return delivered;
    }

    public int connectionCount() {
        return channels.getOrDefault("all", Set.of()).size();
    }

    /** Comment line every 20 s keeps proxies and the gateway from closing idle connections. */
    @Scheduled(fixedRate = 20_000)
    public void heartbeat() {
        for (SseEmitter emitter : channels.getOrDefault("all", Set.of())) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException e) {
                emitter.completeWithError(e);
            }
        }
    }

    private static List<String> channelsFor(CurrentUser user) {
        if (user.isRestaurant() && user.restaurantId() != null) {
            return List.of("all", "user:" + user.id(), "restaurant:" + user.restaurantId());
        }
        if (user.isAdmin()) {
            return List.of("all", "user:" + user.id(), "admin");
        }
        return List.of("all", "user:" + user.id());
    }

    private static boolean send(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
            return true;
        } catch (IOException | IllegalStateException e) {
            log.debug("Dropping closed live connection: {}", e.getMessage());
            emitter.completeWithError(e);
            return false;
        }
    }
}
