package com.campusfood.auth.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.campusfood.auth.user.User;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Issues signed JWT tokens. The API Gateway holds the same secret and validates
 * every request with it, so the other services never need to call the Auth Service.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration validity;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.validity-hours:12}") long validityHours) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.validity = Duration.ofHours(validityHours);
    }

    public String createToken(User user) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("role", user.getRole().name())
                .claim("name", user.getName())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + validity.toMillis()));
        if (user.getRestaurantId() != null) {
            builder.claim("rid", user.getRestaurantId());
        }
        return builder.signWith(key).compact();
    }

    public long validitySeconds() {
        return validity.toSeconds();
    }
}
