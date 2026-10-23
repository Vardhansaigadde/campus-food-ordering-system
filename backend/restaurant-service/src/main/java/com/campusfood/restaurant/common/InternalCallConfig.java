package com.campusfood.restaurant.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import feign.RequestInterceptor;

/** Every Feign call to another microservice carries the shared internal key. */
@Configuration
public class InternalCallConfig {

    @Bean
    public RequestInterceptor internalKeyInterceptor(@Value("${app.security.internal-key}") String internalKey) {
        return template -> template.header("X-Internal-Key", internalKey);
    }
}
