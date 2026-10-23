package com.campusfood.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

/** Feign client for the Auth Service. */
@FeignClient(name = "auth-service")
public interface AuthClient {

    @GetMapping("/internal/users/{id}/order-eligibility")
    Eligibility eligibility(@PathVariable("id") Long userId);

    @PostMapping("/internal/users/{id}/no-show")
    void recordNoShow(@PathVariable("id") Long userId);

    record Eligibility(boolean allowed, String reason) {
    }
}
