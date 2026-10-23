package com.campusfood.restaurant;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Restaurant Service – restaurants, full menus, today's availability, stock and favourites.
 */
@SpringBootApplication
@EnableFeignClients
@EnableCaching
@EnableScheduling
@EnableAsync
public class RestaurantServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
		SpringApplication.run(RestaurantServiceApplication.class, args);
	}

}
