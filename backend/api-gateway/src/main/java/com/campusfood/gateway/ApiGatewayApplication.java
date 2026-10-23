package com.campusfood.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * API Gateway – the single entry point (port 8080). The React app talks only to this.
 * Routes are in application.yml; "lb://name" means: ask Eureka where that service runs
 * and load-balance between its copies.
 */
@SpringBootApplication
public class ApiGatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiGatewayApplication.class, args);
	}

}
