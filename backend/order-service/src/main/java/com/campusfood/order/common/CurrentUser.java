package com.campusfood.order.common;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The logged-in user, as identified by the API Gateway.
 * The gateway validates the JWT and forwards these headers; clients can never set them directly
 * because the gateway strips them from incoming requests and services reject calls without the gateway key.
 */
public record CurrentUser(Long id, String role, String name, Long restaurantId) {

    public static final String HEADER_ID = "X-User-Id";
    public static final String HEADER_ROLE = "X-User-Role";
    public static final String HEADER_NAME = "X-User-Name";
    public static final String HEADER_RESTAURANT = "X-Restaurant-Id";

    public static CurrentUser from(HttpServletRequest request) {
        String id = request.getHeader(HEADER_ID);
        String role = request.getHeader(HEADER_ROLE);
        if (id == null || role == null) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Please log in");
        }
        String name = request.getHeader(HEADER_NAME);
        String rid = request.getHeader(HEADER_RESTAURANT);
        return new CurrentUser(
                Long.valueOf(id),
                role,
                name == null ? "" : URLDecoder.decode(name, StandardCharsets.UTF_8),
                rid == null || rid.isBlank() ? null : Long.valueOf(rid));
    }

    public boolean isStudent() {
        return "STUDENT".equals(role);
    }

    public boolean isRestaurant() {
        return "RESTAURANT".equals(role);
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }

    /** Admin endpoints answer "not found" to everyone else, so nobody learns that an admin exists. */
    public CurrentUser requireAdmin() {
        if (!isAdmin()) {
            throw ApiException.notFound("Not found");
        }
        return this;
    }

    public CurrentUser requireStudent() {
        if (!isStudent()) {
            throw ApiException.forbidden("Only students can do this");
        }
        return this;
    }

    /** Restaurant staff can only ever act on their own restaurant. */
    public Long requireRestaurantId() {
        if (!isRestaurant() || restaurantId == null) {
            throw ApiException.forbidden("Only restaurant staff can do this");
        }
        return restaurantId;
    }
}
