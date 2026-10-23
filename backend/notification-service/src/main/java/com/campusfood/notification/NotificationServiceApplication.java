package com.campusfood.notification;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Notification Service – live updates to browsers (Server-Sent Events), announcements and the audit log.
 */
@SpringBootApplication
@EnableScheduling
public class NotificationServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
		SpringApplication.run(NotificationServiceApplication.class, args);
	}

}
