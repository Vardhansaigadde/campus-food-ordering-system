package com.campusfood.auth.user;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.auth.common.ApiException;
import com.campusfood.auth.common.PageResponse;

@Service
public class UserService {

    /** 3 no-shows => no ordering for 7 days. */
    public static final int NO_SHOW_LIMIT = 3;
    public static final int BAN_DAYS = 7;

    private final UserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UserService(UserRepository users) {
        this.users = users;
    }

    // ---------------------------------------------------------------- registration & login

    @Transactional
    public User registerStudent(String name, String email, String phone, String password) {
        String normalized = normalizeEmail(email);
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User u = new User();
        u.setName(name.trim());
        u.setEmail(normalized);
        u.setPhone(blankToNull(phone));
        u.setPasswordHash(encoder.encode(password));
        u.setRole(Role.STUDENT);
        return users.save(u);
    }

    /** Login for students and restaurant staff. Admin accounts are deliberately NOT accepted here. */
    public User login(String email, String password) {
        User u = users.findByEmail(normalizeEmail(email))
                .filter(x -> x.getRole() != Role.ADMIN)
                .filter(x -> encoder.matches(password, x.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        ensureNotBlocked(u);
        return u;
    }

    /** Hidden admin login. Any failure looks like a missing page. */
    public User adminLogin(String email, String password) {
        return users.findByEmail(normalizeEmail(email))
                .filter(x -> x.getRole() == Role.ADMIN)
                .filter(x -> encoder.matches(password, x.getPasswordHash()))
                .orElseThrow(() -> ApiException.notFound("Not found"));
    }

    public User get(Long id) {
        return users.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    public void ensureNotBlocked(User u) {
        if (u.isBlocked()) {
            throw ApiException.forbidden("Your account has been blocked. Please contact the canteen office.");
        }
    }

    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        User u = get(userId);
        if (!encoder.matches(oldPassword, u.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        u.setPasswordHash(encoder.encode(newPassword));
    }

    // ---------------------------------------------------------------- restaurant logins (created by admin)

    @Transactional
    public User createRestaurantLogin(Long restaurantId, String name, String email, String password) {
        String normalized = normalizeEmail(email);
        if (users.existsByEmail(normalized)) {
            throw ApiException.conflict("Login email " + normalized + " is already used");
        }
        User u = new User();
        u.setName(name.trim());
        u.setEmail(normalized);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(Role.RESTAURANT);
        u.setRestaurantId(restaurantId);
        return users.save(u);
    }

    @Transactional
    public void setRestaurantLoginsBlocked(Long restaurantId, boolean blocked) {
        users.findByRestaurantId(restaurantId).forEach(u -> u.setBlocked(blocked));
    }

    public List<UserDto> restaurantLogins(Long restaurantId) {
        return users.findByRestaurantId(restaurantId).stream().map(UserDto::of).toList();
    }

    // ---------------------------------------------------------------- ordering eligibility & no-shows

    public record Eligibility(boolean allowed, String reason) {
    }

    public Eligibility orderEligibility(Long userId) {
        User u = get(userId);
        if (u.isBlocked()) {
            return new Eligibility(false, "Your account has been blocked by the canteen office.");
        }
        if (u.getOrderBanUntil() != null && u.getOrderBanUntil().isAfter(LocalDateTime.now())) {
            return new Eligibility(false, "Ordering is paused until " + u.getOrderBanUntil().toLocalDate()
                    + " because of " + NO_SHOW_LIMIT + " uncollected orders.");
        }
        return new Eligibility(true, null);
    }

    /** Called by the Order Service when a Ready order was not collected within 3 hours. */
    @Transactional
    public UserDto recordNoShow(Long userId) {
        User u = get(userId);
        u.setTotalNoShows(u.getTotalNoShows() + 1);
        u.setNoShowCount(u.getNoShowCount() + 1);
        if (u.getNoShowCount() >= NO_SHOW_LIMIT) {
            u.setOrderBanUntil(LocalDateTime.now().plusDays(BAN_DAYS));
            u.setNoShowCount(0);
        }
        return UserDto.of(u);
    }

    // ---------------------------------------------------------------- admin

    public PageResponse<UserDto> search(Role role, String q, int page, int size) {
        String query = blankToNull(q);
        return PageResponse.of(users.search(role, query, PageRequest.of(page, Math.min(size, 100))).map(UserDto::of));
    }

    public List<UserDto> noShowList() {
        return users.findWithNoShows().stream().map(UserDto::of).toList();
    }

    @Transactional
    public UserDto setBlocked(Long id, boolean blocked) {
        User u = get(id);
        if (u.getRole() == Role.ADMIN) {
            throw ApiException.notFound("User not found");
        }
        u.setBlocked(blocked);
        return UserDto.of(u);
    }

    @Transactional
    public UserDto clearOrderBan(Long id) {
        User u = get(id);
        u.setOrderBanUntil(null);
        u.setNoShowCount(0);
        return UserDto.of(u);
    }

    @Transactional
    public void resetPassword(Long id, String newPassword) {
        User u = get(id);
        if (u.getRole() == Role.ADMIN) {
            throw ApiException.notFound("User not found");
        }
        u.setPasswordHash(encoder.encode(newPassword));
    }

    public record UserStats(long students, long restaurantLogins, long blocked) {
    }

    public UserStats stats() {
        return new UserStats(users.countByRole(Role.STUDENT), users.countByRole(Role.RESTAURANT),
                users.countByBlockedTrue());
    }

    // ---------------------------------------------------------------- admin seeding

    @Transactional
    public void ensureAdmin(String name, String email, String password) {
        if (users.existsByRole(Role.ADMIN)) {
            return;
        }
        User u = new User();
        u.setName(name);
        u.setEmail(normalizeEmail(email));
        u.setPasswordHash(encoder.encode(password));
        u.setRole(Role.ADMIN);
        users.save(u);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
