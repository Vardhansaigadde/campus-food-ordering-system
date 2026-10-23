package com.campusfood.gateway.security;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import reactor.core.publisher.Mono;

/**
 * Simple per-minute rate limiting so one user (or a script) cannot flood the system:
 * logged-in users are limited per account, login/register attempts per network address.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    static final String USER_ATTRIBUTE = "cf.userId";

    private final int perUserPerMinute;
    private final int loginPerIpPerMinute;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${app.rate-limit.per-user-per-minute:240}") int perUserPerMinute,
                           @Value("${app.rate-limit.login-per-ip-per-minute:120}") int loginPerIpPerMinute) {
        this.perUserPerMinute = perUserPerMinute;
        this.loginPerIpPerMinute = loginPerIpPerMinute;
    }

    /** After the JWT filter, so the user id is known. */
    @Override
    public int getOrder() {
        return -90;
    }

    private static final class Window {
        final long minute;
        final AtomicInteger count = new AtomicInteger();

        Window(long minute) {
            this.minute = minute;
        }
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();
        if (path.equals("/api/notifications/stream")) {
            return chain.filter(exchange);
        }
        String user = exchange.getAttribute(USER_ATTRIBUTE);
        String bucket;
        int limit;
        if (user != null) {
            bucket = "u:" + user;
            limit = perUserPerMinute;
        } else if (path.startsWith("/api/auth/")) {
            InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
            bucket = "ip:" + (remote == null ? "unknown" : remote.getAddress().getHostAddress());
            limit = loginPerIpPerMinute;
        } else {
            return chain.filter(exchange);
        }

        long minute = System.currentTimeMillis() / 60_000;
        Window w = windows.compute(bucket, (k, old) -> old == null || old.minute != minute ? new Window(minute) : old);
        if (w.count.incrementAndGet() > limit) {
            exchange.getResponse().getHeaders().set("Retry-After", "60");
            return Errors.write(exchange, HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please wait a minute.");
        }
        if (windows.size() > 50_000) {
            windows.entrySet().removeIf(e -> e.getValue().minute != minute);
        }
        return chain.filter(exchange);
    }
}
