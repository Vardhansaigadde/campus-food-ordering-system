package com.campusfood.auth.common;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Makes sure requests only arrive through the right door:
 *  - /api/**      must come through the API Gateway (it adds a secret X-Gateway-Key header)
 *  - /internal/** must come from another microservice (secret X-Internal-Key header)
 * Calling a service port directly from a browser is therefore rejected.
 */
@Component
public class GatewayKeyFilter extends OncePerRequestFilter {

    @Value("${app.security.gateway-key}")
    private String gatewayKey;

    @Value("${app.security.internal-key}")
    private String internalKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path.startsWith("/api/") && !gatewayKey.equals(request.getHeader("X-Gateway-Key"))) {
            reject(response, "Requests must go through the API Gateway (port 8080)");
            return;
        }
        if (path.startsWith("/internal/") && !internalKey.equals(request.getHeader("X-Internal-Key"))) {
            reject(response, "Internal endpoint");
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":401,\"message\":\"" + message + "\"}");
    }
}
