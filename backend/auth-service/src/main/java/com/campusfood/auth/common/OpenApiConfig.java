package com.campusfood.auth.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

/**
 * Swagger UI at http://localhost:{service-port}/swagger-ui.html.
 * "Try it out" sends requests through the API Gateway, exactly like the React app does.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openApi(@Value("${spring.application.name}") String name) {
        return new OpenAPI()
                .info(new Info().title("Campus Food – " + name).version("1.0")
                        .description("REST API of the " + name + " microservice"))
                .addServersItem(new Server().url("http://localhost:8080").description("API Gateway"))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
