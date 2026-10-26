package com.campusfood.restaurant.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.client.AuthClient;
import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantRepository;
import com.campusfood.restaurant.domain.RestaurantStatus;
import com.campusfood.restaurant.dto.Requests;
import com.campusfood.restaurant.dto.RestaurantView;

import feign.FeignException;

@Service
public class RestaurantService {

    private static final Logger log = LoggerFactory.getLogger(RestaurantService.class);
    private static final int DEFAULT_BUSY_MINUTES = 15;

    private final RestaurantRepository restaurants;
    private final DishRepository dishes;
    private final AuthClient authClient;

    public RestaurantService(RestaurantRepository restaurants, DishRepository dishes, AuthClient authClient) {
        this.restaurants = restaurants;
        this.dishes = dishes;
        this.authClient = authClient;
    }

    // ---------------------------------------------------------------- read

    /** Restaurants students can see (removed ones are hidden). */
    public List<RestaurantView> listForStudents() {
        Map<Long, Long> counts = menuCounts();
        return restaurants.findByActiveTrueOrderByNameAsc().stream()
                .map(r -> RestaurantView.of(r, counts.getOrDefault(r.getId(), 0L)))
                .sorted((a, b) -> Integer.compare(a.status().ordinal(), b.status().ordinal()))
                .toList();
    }

    public List<RestaurantView> listForAdmin() {
        Map<Long, Long> counts = menuCounts();
        return restaurants.findAllByOrderByActiveDescNameAsc().stream()
                .map(r -> RestaurantView.of(r, counts.getOrDefault(r.getId(), 0L)))
                .toList();
    }

    public Restaurant getActive(Long id) {
        return restaurants.findById(id).filter(Restaurant::isActive)
                .orElseThrow(() -> ApiException.notFound("Restaurant not found"));
    }

    public Restaurant get(Long id) {
        return restaurants.findById(id).orElseThrow(() -> ApiException.notFound("Restaurant not found"));
    }

    public RestaurantView view(Restaurant r) {
        return RestaurantView.of(r, menuCounts().getOrDefault(r.getId(), 0L));
    }

    private Map<Long, Long> menuCounts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : dishes.countMenuByRestaurant(LocalDate.now())) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    // ---------------------------------------------------------------- status (Open / Busy / Closed)

    @Transactional
    public Restaurant changeStatus(Long id, RestaurantStatus status, Integer busyMinutes) {
        Restaurant r = getActive(id);
        r.setStatus(status);
        r.setBusyUntil(status == RestaurantStatus.BUSY
                ? LocalDateTime.now().plusMinutes(busyMinutes == null ? DEFAULT_BUSY_MINUTES : busyMinutes)
                : null);
        return r;
    }

    /**
     * Runs every minute: ends finished "Busy" pauses and closes restaurants at their auto-close time.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 10_000)
    @Transactional
    public void housekeeping() {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();
        LocalTime time = now.toLocalTime();
        for (Restaurant r : restaurants.findByActiveTrueAndStatusNot(RestaurantStatus.CLOSED)) {
            if (r.getStatus() == RestaurantStatus.BUSY && r.getBusyUntil() != null && now.isAfter(r.getBusyUntil())) {
                r.setStatus(RestaurantStatus.OPEN);
                r.setBusyUntil(null);
            }
            if (r.getAutoCloseTime() != null && !time.isBefore(r.getAutoCloseTime())
                    && !today.equals(r.getLastAutoClosedOn())) {
                r.setStatus(RestaurantStatus.CLOSED);
                r.setBusyUntil(null);
                r.setLastAutoClosedOn(today);
                log.info("Auto-closed restaurant {} at {}", r.getName(), r.getAutoCloseTime());
            }
        }
    }

    // ---------------------------------------------------------------- staff profile

    @Transactional
    public Restaurant updateProfile(Long id, Requests.UpdateProfile req) {
        Restaurant r = getActive(id);
        r.setDescription(trim(req.description()));
        r.setImageUrl(trim(req.imageUrl()));
        r.setOpeningHours(trim(req.openingHours()));
        setAutoClose(r, req.autoCloseTime());
        if (req.holdMinutes() != null) {
            r.setHoldMinutes(req.holdMinutes());
        }
        if (req.preordersEnabled() != null) {
            r.setPreordersEnabled(req.preordersEnabled());
        }
        r.setAutoOpenTime(req.autoOpenTime());
        // A new auto-open time later today should still fire today
        if (req.autoOpenTime() != null && LocalTime.now().isBefore(req.autoOpenTime())) {
            r.setLastAutoOpenedOn(null);
        }
        return r;
    }

    // ---------------------------------------------------------------- admin

    /**
     * Creates the restaurant and (through Feign) its staff login in the Auth Service.
     * If the login cannot be created the whole operation is rolled back.
     */
    @Transactional
    public Restaurant create(Requests.CreateRestaurant req) {
        String code = req.code().toUpperCase(Locale.ROOT);
        if (restaurants.existsByCode(code)) {
            throw ApiException.conflict("Code " + code + " is already used by another restaurant");
        }
        Restaurant r = new Restaurant();
        r.setName(req.name().trim());
        r.setCode(code);
        r.setDescription(trim(req.description()));
        r.setLocation(trim(req.location()));
        r.setImageUrl(trim(req.imageUrl()));
        r.setOpeningHours(trim(req.openingHours()));
        r.setAutoCloseTime(req.autoCloseTime());
        r.setStatus(RestaurantStatus.CLOSED);
        restaurants.saveAndFlush(r);
        createLogin(r, r.getName() + " Staff", req.loginEmail(), req.loginPassword());
        return r;
    }

    public void addLogin(Long restaurantId, Requests.AddLogin req) {
        Restaurant r = getActive(restaurantId);
        createLogin(r, req.name(), req.email(), req.password());
    }

    private void createLogin(Restaurant r, String name, String email, String password) {
        try {
            authClient.createRestaurantLogin(new AuthClient.RestaurantLogin(r.getId(), name, email, password));
        } catch (FeignException.Conflict e) {
            throw ApiException.conflict("Login email " + email + " is already used");
        } catch (FeignException e) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not create the staff login (Auth Service unavailable). Please try again.");
        }
    }

    @Transactional
    public Restaurant update(Long id, Requests.UpdateRestaurant req) {
        Restaurant r = get(id);
        r.setName(req.name().trim());
        r.setDescription(trim(req.description()));
        r.setLocation(trim(req.location()));
        r.setImageUrl(trim(req.imageUrl()));
        r.setOpeningHours(trim(req.openingHours()));
        setAutoClose(r, req.autoCloseTime());
        return r;
    }

    /** Removing hides the restaurant from students and blocks its staff logins. Orders history is kept. */
    @Transactional
    public Restaurant setActive(Long id, boolean active) {
        Restaurant r = get(id);
        r.setActive(active);
        if (!active) {
            r.setStatus(RestaurantStatus.CLOSED);
        }
        try {
            authClient.blockRestaurantLogins(id, new AuthClient.Block(!active));
        } catch (FeignException e) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Auth Service unavailable. Please try again.");
        }
        return r;
    }

    @Transactional
    public void addRating(Long restaurantId, int stars) {
        restaurants.findById(restaurantId).ifPresent(r -> {
            r.setRatingSum(r.getRatingSum() + stars);
            r.setRatingCount(r.getRatingCount() + 1);
        });
    }

    private static void setAutoClose(Restaurant r, LocalTime autoClose) {
        r.setAutoCloseTime(autoClose);
        // A new auto-close time later today should still fire today
        if (autoClose != null && LocalTime.now().isBefore(autoClose)) {
            r.setLastAutoClosedOn(null);
        }
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
