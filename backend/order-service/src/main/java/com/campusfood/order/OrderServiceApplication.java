package com.campusfood.order;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Order Service – orders, Order ID + OTP, live queue, verification at the counter, no-shows and reports.
 * Can run as several copies (e.g. ports 8083 and 8093); Eureka + the gateway share the load between them.
 */
@SpringBootApplication
@EnableFeignClients
@EnableScheduling
@EnableAsync
public class OrderServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
		SpringApplication.run(OrderServiceApplication.class, args);
	}

}
