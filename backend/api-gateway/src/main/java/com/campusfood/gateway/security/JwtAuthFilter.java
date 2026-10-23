package com.campusfood.gateway.security;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import reactor.core.publisher.Mono;

/**
 * Runs for every request through the gateway:
 * <ol>
 *   <li>Removes any identity headers a client tried to send itself (anti-spoofing).</li>
 *   <li>Validates the JWT signature and expiry (same secret as the Auth Service).</li>
 *   <li>Applies the role rules from {@link AccessRules}.</li>
 *   <li>Forwards the user's id / role / name / restaurant as trusted headers, plus the secret
 *       X-Gateway-Key so services know the request really came through the gateway.</li>
 * </ol>
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final String STREAM_PATH = "/api/notifications/stream";

    private final SecretKey key;
    private final String gatewayKey;

    public JwtAuthFilter(@Value("${app.jwt.secret}") String secret,
                         @Value("${app.security.gateway-key}") String gatewayKey) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.gatewayKey = gatewayKey;
    }

    @Override
    public int getOrder() {
        return -100;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        ServerHttpRequest.Builder forward = request.mutate().headers(h -> {
            h.remove("X-User-Id");
            h.remove("X-User-Role");
            h.remove("X-User-Name");
            h.remove("X-Restaurant-Id");
            h.remove("X-Internal-Key");
            h.set("X-Gateway-Key", gatewayKey);
        });

        if (!path.startsWith("/api/") || AccessRules.isPublic(request.getMethod(), path)) {
            return chain.filter(exchange.mutate().request(forward.build()).build());
        }

        Claims claims = parse(request, path);
        if (claims == null) {
            // Hide the admin area completely: no token -> "not found", not "please log in"
            return Errors.write(exchange, AccessRules.isAdminArea(path) ? HttpStatus.NOT_FOUND : HttpStatus.UNAUTHORIZED,
                    AccessRules.isAdminArea(path) ? "Not found" : "Please log in again");
        }

        String role = claims.get("role", String.class);
        HttpStatus denied = AccessRules.check(path, role);
        if (denied != null) {
            return Errors.write(exchange, denied, denied == HttpStatus.NOT_FOUND ? "Not found"
                    : "You don't have access to this page");
        }

        Object rid = claims.get("rid");
        String name = claims.get("name", String.class);
        forward.headers(h -> {
            h.set("X-User-Id", claims.getSubject());
            h.set("X-User-Role", role);
            h.set("X-User-Name", URLEncoder.encode(name == null ? "" : name, StandardCharsets.UTF_8));
            if (rid instanceof Number n) {
                h.set("X-Restaurant-Id", String.valueOf(n.longValue()));
            }
        });
        exchange.getAttributes().put(RateLimitFilter.USER_ATTRIBUTE, claims.getSubject());
        return chain.filter(exchange.mutate().request(forward.build()).build());
    }

    private Claims parse(ServerHttpRequest request, String path) {
        String token = null;
        String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7);
        } else if (STREAM_PATH.equals(path)) {
            // Browsers' EventSource cannot send headers, so the live stream passes the token in the URL
            token = request.getQueryParams().getFirst("token");
        }
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
