package com.campusfood.auth;

import java.util.TimeZone;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;

import com.campusfood.auth.user.UserService;

/**
 * Auth Service – accounts, login and JWT tokens for the three roles (STUDENT, RESTAURANT, ADMIN).
 */
@SpringBootApplication
@EnableFeignClients
@EnableAsync
public class AuthServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
		SpringApplication.run(AuthServiceApplication.class, args);
	}

	/** The single hidden admin account is created from configuration – there is no admin sign-up. */
	@Bean
	CommandLineRunner seedAdmin(UserService users,
								@Value("${app.admin.name}") String name,
								@Value("${app.admin.email}") String email,
								@Value("${app.admin.password}") String password) {
		return args -> users.ensureAdmin(name, email, password);
	}

}
