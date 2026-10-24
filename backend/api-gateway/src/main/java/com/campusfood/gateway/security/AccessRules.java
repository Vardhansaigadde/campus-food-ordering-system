package com.campusfood.gateway.security;

import java.util.Set;

import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * Who may call which URL – checked at the gateway before a request reaches any microservice.
 *
 * <pre>
 *  /api/admin/**                      ADMIN only (everyone else gets 404 – the admin area "does not exist")
 *  /api/restaurant/**                 RESTAURANT staff only (their own restaurant, enforced again in the service)
 *  /api/orders/**, /api/favourites/** STUDENT only
 *  /api/restaurants/**                STUDENT (and ADMIN for checking)
 *  login / register / announcements   public
 *  GET /api/photos/** (dish photos)    public
 *  everything else under /api         any logged-in user
 * </pre>
 */
public final class AccessRules {

    private AccessRules() {
    }

    private static final Set<String> PUBLIC_POST = Set.of("/api/auth/login", "/api/auth/register", "/api/auth/ops/login");
    private static final Set<String> PUBLIC_GET = Set.of("/api/announcements/active");

    public static boolean isPublic(HttpMethod method, String path) {
        return (HttpMethod.POST.equals(method) && PUBLIC_POST.contains(path))
                || (HttpMethod.GET.equals(method) && (PUBLIC_GET.contains(path) || path.startsWith("/api/photos/")))
                || HttpMethod.OPTIONS.equals(method);
    }

    public static boolean isAdminArea(String path) {
        return path.startsWith("/api/admin/") || path.equals("/api/admin");
    }

    /** @return null if allowed, otherwise the status to answer with. */
    public static HttpStatus check(String path, String role) {
        if (isAdminArea(path)) {
            return "ADMIN".equals(role) ? null : HttpStatus.NOT_FOUND;
        }
        if (path.startsWith("/api/restaurant/")) {
            return "RESTAURANT".equals(role) ? null : HttpStatus.FORBIDDEN;
        }
        if (path.startsWith("/api/orders") || path.startsWith("/api/favourites")) {
            return "STUDENT".equals(role) ? null : HttpStatus.FORBIDDEN;
        }
        if (path.startsWith("/api/restaurants")) {
            return "STUDENT".equals(role) || "ADMIN".equals(role) ? null : HttpStatus.FORBIDDEN;
        }
        return null;
    }
}
