package com.campusfood.order.client;

import java.util.List;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.campusfood.order.common.ApiException;

import feign.FeignException;

/**
 * All calls from the Order Service to other microservices go through a Resilience4j circuit breaker.
 * <ul>
 *   <li>Business answers (sold out, closed, banned…) are passed on to the student unchanged.</li>
 *   <li>If a service is down or slow, the student gets a clear "try again" message instead of an
 *       endless spinner, and after repeated failures the breaker opens so we stop hammering it.</li>
 * </ul>
 */
@Component
public class RemoteCalls {

    private static final Logger log = LoggerFactory.getLogger(RemoteCalls.class);
    private static final Pattern MESSAGE = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    private final CircuitBreakerFactory<?, ?> breakers;
    private final RestaurantClient restaurants;
    private final AuthClient auth;

    public RemoteCalls(CircuitBreakerFactory<?, ?> breakers, RestaurantClient restaurants, AuthClient auth) {
        this.breakers = breakers;
        this.restaurants = restaurants;
        this.auth = auth;
    }

    public RestaurantClient.Reservation reserve(Long restaurantId, List<RestaurantClient.Item> items) {
        return call("restaurant-service", "Restaurant service",
                () -> restaurants.reserve(restaurantId, new RestaurantClient.Items(items)));
    }

    /** Best effort: if it fails the stock is simply not returned (logged for the restaurant to fix). */
    public void release(Long restaurantId, List<RestaurantClient.Item> items) {
        try {
            call("restaurant-service", "Restaurant service", () -> {
                restaurants.release(restaurantId, new RestaurantClient.Items(items));
                return null;
            });
        } catch (RuntimeException e) {
            log.warn("Could not return stock for restaurant {}: {}", restaurantId, e.getMessage());
        }
    }

    public void rate(RestaurantClient.Ratings ratings) {
        try {
            call("restaurant-service", "Restaurant service", () -> {
                restaurants.rate(ratings);
                return null;
            });
        } catch (RuntimeException e) {
            log.warn("Could not forward rating: {}", e.getMessage());
        }
    }

    public AuthClient.Eligibility eligibility(Long userId) {
        return call("auth-service", "Account service", () -> auth.eligibility(userId));
    }

    public void recordNoShow(Long userId) {
        call("auth-service", "Account service", () -> {
            auth.recordNoShow(userId);
            return null;
        });
    }

    private <T> T call(String breaker, String label, Supplier<T> supplier) {
        return breakers.create(breaker).run(supplier, failure -> {
            throw translate(failure, label);
        });
    }

    private static RuntimeException translate(Throwable failure, String label) {
        // The time limiter runs the call on another thread, which may wrap the real exception
        while ((failure instanceof java.util.concurrent.ExecutionException
                || failure instanceof java.util.concurrent.CompletionException) && failure.getCause() != null) {
            failure = failure.getCause();
        }
        if (failure instanceof ApiException e) {
            return e;
        }
        if (failure instanceof FeignException.FeignClientException e) {
            // 4xx from the other service: a real business answer – pass its message on
            HttpStatus status = HttpStatus.resolve(e.status());
            return new ApiException(status == null ? HttpStatus.BAD_REQUEST : status, extractMessage(e));
        }
        log.warn("{} call failed: {}", label, failure.toString());
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                label + " is temporarily unavailable. Please try again in a minute.");
    }

    private static String extractMessage(FeignException e) {
        String body = e.contentUTF8();
        if (body != null) {
            Matcher m = MESSAGE.matcher(body);
            if (m.find()) {
                return m.group(1).replace("\\\"", "\"");
            }
        }
        return "Request could not be completed";
    }
}
