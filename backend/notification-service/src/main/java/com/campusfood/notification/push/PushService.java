package com.campusfood.notification.push;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.campusfood.notification.common.ApiException;
import com.campusfood.notification.common.CurrentUser;

import jakarta.annotation.PreDestroy;

/**
 * Sends "Web Push" alerts that reach a phone even when the app is closed and the screen is locked.
 * The live SSE stream (LiveHub) still handles open screens; this is the backup that wakes the phone.
 * Free and open standard – the phone's own push service (Google, Mozilla, Apple) delivers it.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    /** Only events worth waking a phone for. Everything else stays in-app. */
    private static final Set<String> STAFF_TYPES = Set.of(
            "NEW_ORDER",                 // something to cook (ready-made bookings need no action, so no buzz)
            "ORDER_CANCELLED",
            "STOCK_LOW", "SOLD_OUT",     // the owner may want to cook more
            "DAY_SUMMARY");              // evening: cash in box, plates, no-shows
    private static final Set<String> PUSH_TYPES = Set.of(
            "NEW_ORDER", "ORDER_CANCELLED", "STOCK_LOW", "SOLD_OUT", "DAY_SUMMARY",
            "ORDER_READY", "ORDER_REJECTED", "ORDER_NO_SHOW",
            "ORDER_ON_THE_WAY", "ORDER_DELIVERY_MISSED",  // faculty delivery
            "FACULTY_APPROVED", "FACULTY_REJECTED");

    /** Push services we will talk to. Anything else could be used to make this server call arbitrary URLs. */
    private static final List<String> ALLOWED_HOST_SUFFIXES = List.of(
            "fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com",
            "push.apple.com", "notify.windows.com");

    private final PushSubscriptionRepository subscriptions;
    private final VapidKeyRepository vapidKeys;
    private final String subject;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ExecutorService sender = Executors.newVirtualThreadPerTaskExecutor();
    private volatile KeyPair keys;

    public PushService(PushSubscriptionRepository subscriptions, VapidKeyRepository vapidKeys,
                       @Value("${app.push.subject:mailto:admin@campusfood.local}") String subject) {
        this.subscriptions = subscriptions;
        this.vapidKeys = vapidKeys;
        this.subject = subject;
    }

    @PreDestroy
    void shutdown() {
        sender.shutdown();
    }

    // ---------------------------------------------------------------- keys

    public String publicKey() {
        return WebPushCrypto.b64(WebPushCrypto.rawPublicKey((ECPublicKey) keys().getPublic()));
    }

    private KeyPair keys() {
        KeyPair k = keys;
        if (k == null) {
            synchronized (this) {
                if (keys == null) {
                    keys = loadOrCreateKeys();
                }
                k = keys;
            }
        }
        return k;
    }

    private KeyPair loadOrCreateKeys() {
        return vapidKeys.findById(1L)
                .map(v -> WebPushCrypto.keyPairFromRaw(WebPushCrypto.unb64(v.getPublicKey()), WebPushCrypto.unb64(v.getPrivateKey())))
                .orElseGet(() -> {
                    KeyPair generated = WebPushCrypto.generateKeyPair();
                    VapidKey row = new VapidKey();
                    row.setPublicKey(WebPushCrypto.b64(WebPushCrypto.rawPublicKey((ECPublicKey) generated.getPublic())));
                    row.setPrivateKey(WebPushCrypto.b64(WebPushCrypto.rawPrivateKey((ECPrivateKey) generated.getPrivate())));
                    vapidKeys.save(row);
                    log.info("Created the server's push (VAPID) key pair");
                    return generated;
                });
    }

    // ---------------------------------------------------------------- subscriptions

    public void subscribe(CurrentUser user, String endpoint, String p256dh, String auth) {
        URI uri = validEndpoint(endpoint);
        // Reject keys we could never encrypt for before storing them
        try {
            WebPushCrypto.publicKeyFromRaw(WebPushCrypto.unb64(p256dh));
            if (WebPushCrypto.unb64(auth).length != 16) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid push subscription keys");
        }
        PushSubscription sub = subscriptions.findByEndpoint(uri.toString()).orElseGet(PushSubscription::new);
        // The same phone may log in as someone else: the subscription follows the latest login
        sub.setEndpoint(uri.toString());
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setUserId(user.id());
        sub.setRole(user.role());
        sub.setRestaurantId(user.isRestaurant() ? user.restaurantId() : null);
        subscriptions.save(sub);
    }

    public void unsubscribe(CurrentUser user, String endpoint) {
        subscriptions.deleteByEndpointAndUserId(endpoint, user.id());
    }

    private static URI validEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            boolean allowed = ALLOWED_HOST_SUFFIXES.stream().anyMatch(s -> host.equals(s) || host.endsWith("." + s));
            if ("https".equals(uri.getScheme()) && allowed) {
                return uri;
            }
        } catch (IllegalArgumentException ignored) {
            // fall through
        }
        throw ApiException.badRequest("Unsupported push service");
    }

    // ---------------------------------------------------------------- sending

    /** Called for every live event; sends a push only for the important ones, in the background. */
    public void sendAsync(List<String> channels, String type, String title, String message, Map<String, Object> data) {
        if (!PUSH_TYPES.contains(type) || title == null) {
            return;
        }
        sender.submit(() -> {
            try {
                send(channels, type, title, message, data == null ? Map.of() : data);
            } catch (Exception e) {
                log.warn("Push for {} failed: {}", type, e.getMessage());
            }
        });
    }

    private void send(List<String> channels, String type, String title, String message, Map<String, Object> data) {
        boolean staff = STAFF_TYPES.contains(type);
        Map<String, PushSubscription> targets = new LinkedHashMap<>();
        for (String channel : channels) {
            Long id = idAfter(channel, staff ? "restaurant:" : "user:");
            if (id == null) {
                continue;
            }
            List<PushSubscription> found = staff ? subscriptions.findByRestaurantId(id) : subscriptions.findByUserId(id);
            found.forEach(s -> targets.putIfAbsent(s.getEndpoint(), s));
        }
        if (targets.isEmpty()) {
            return;
        }
        Object orderId = data.get("orderId");
        String url = staff
                ? ("NEW_ORDER".equals(type) || "ORDER_CANCELLED".equals(type) ? "/kitchen/orders"
                        : "DAY_SUMMARY".equals(type) ? "/kitchen/summary" : "/kitchen")
                : type.startsWith("FACULTY_") ? "/account"
                : (orderId != null ? "/orders/" + orderId : "/orders");
        Object token = data.get("token");
        byte[] payload = json(Map.of(
                "title", title,
                "body", message == null ? "" : message,
                "type", type,
                "url", url,
                // One notification per order: "ready" replaces "preparing" instead of stacking up
                "tag", type.startsWith("STOCK") || type.equals("SOLD_OUT") || type.equals("DAY_SUMMARY") ? type + ":" + title
                        : token != null ? token + ":" + (staff ? "staff" : "student") : type,
                "urgent", "NEW_ORDER".equals(type) || "SOLD_OUT".equals(type) || "ORDER_READY".equals(type)
                        || "ORDER_ON_THE_WAY".equals(type) || "ORDER_DELIVERY_MISSED".equals(type)))
                .getBytes(StandardCharsets.UTF_8);
        for (PushSubscription sub : targets.values()) {
            deliver(sub, payload);
        }
    }

    private void deliver(PushSubscription sub, byte[] payload) {
        try {
            URI endpoint = URI.create(sub.getEndpoint());
            byte[] body = WebPushCrypto.encrypt(payload, WebPushCrypto.unb64(sub.getP256dh()), WebPushCrypto.unb64(sub.getAuth()));
            String audience = endpoint.getScheme() + "://" + endpoint.getHost();
            long exp = Instant.now().plus(Duration.ofHours(12)).getEpochSecond();
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    // An order alert older than 30 min is useless; "high" wakes a sleeping phone
                    .header("TTL", "1800")
                    .header("Urgency", "high")
                    .header("Authorization", WebPushCrypto.vapidAuthorization(audience, subject, keys(), exp))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status == 404 || status == 410) {
                // The phone unsubscribed or the app was uninstalled
                subscriptions.deleteByEndpoint(sub.getEndpoint());
            } else if (status >= 400) {
                log.warn("Push service answered {} for user {}: {}", status, sub.getUserId(), response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Push to user {} failed: {}", sub.getUserId(), e.getMessage());
        }
    }

    private static Long idAfter(String channel, String prefix) {
        if (!channel.startsWith(prefix)) {
            return null;
        }
        try {
            return Long.valueOf(channel.substring(prefix.length()));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Flat JSON object of strings and booleans – all a push payload needs. */
    static String json(Map<String, Object> fields) {
        StringBuilder sb = new StringBuilder("{");
        fields.forEach((k, v) -> {
            if (sb.length() > 1) {
                sb.append(',');
            }
            sb.append('"').append(escape(k)).append("\":");
            if (v instanceof Boolean || v instanceof Number) {
                sb.append(v);
            } else {
                sb.append('"').append(escape(String.valueOf(v))).append('"');
            }
        });
        return sb.append('}').toString();
    }

    private static String escape(String s) {
        StringBuilder out = new StringBuilder(s.length() + 8);
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }
}
