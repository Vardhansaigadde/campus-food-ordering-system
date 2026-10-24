package com.campusfood.restaurant.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.DeliveryLocation;
import com.campusfood.restaurant.domain.DeliveryLocationRepository;
import com.campusfood.restaurant.domain.Restaurant;

/**
 * Faculty delivery on the canteen side: the admin's list of buildings, each canteen's delivery
 * settings (runs, fee, minimum, buildings) and the check the Order Service makes before it
 * accepts a delivery order.
 */
@Service
public class DeliveryService {

    private static final int MAX_RUNS = 6;

    private final DeliveryLocationRepository locations;
    private final RestaurantService restaurants;

    public DeliveryService(DeliveryLocationRepository locations, RestaurantService restaurants) {
        this.locations = locations;
        this.restaurants = restaurants;
    }

    public record Location(Long id, String name, boolean active) {

        static Location of(DeliveryLocation l) {
            return new Location(l.getId(), l.getName(), l.isActive());
        }
    }

    public record Settings(boolean enabled, BigDecimal fee, BigDecimal minOrder, List<String> runs,
                           Integer cutoffMinutes, List<Long> locationIds) {
    }

    /** What the Order Service needs to save a delivery order. */
    public record Quote(BigDecimal fee, BigDecimal minOrder, String locationName, LocalDateTime runAt) {
    }

    // ---------------------------------------------------------------- buildings (admin)

    public List<Location> activeLocations() {
        return locations.findByActiveTrueOrderByNameAsc().stream().map(Location::of).toList();
    }

    public List<Location> allLocations() {
        return locations.findAllByOrderByNameAsc().stream().map(Location::of).toList();
    }

    @Transactional
    public Location addLocation(String name) {
        String clean = name.trim().replaceAll("\\s+", " ");
        if (locations.existsByNameIgnoreCase(clean)) {
            throw ApiException.conflict(clean + " is already in the list");
        }
        DeliveryLocation l = new DeliveryLocation();
        l.setName(clean);
        return Location.of(locations.save(l));
    }

    @Transactional
    public Location updateLocation(Long id, String name, boolean active) {
        DeliveryLocation l = locations.findById(id).orElseThrow(() -> ApiException.notFound("Delivery place not found"));
        String clean = name.trim().replaceAll("\\s+", " ");
        if (locations.existsByNameIgnoreCaseAndIdNot(clean, id)) {
            throw ApiException.conflict(clean + " is already in the list");
        }
        l.setName(clean);
        l.setActive(active);
        return Location.of(l);
    }

    // ---------------------------------------------------------------- canteen settings (owner)

    public Settings settings(Long restaurantId) {
        Restaurant r = restaurants.getActive(restaurantId);
        return new Settings(r.isDeliveryEnabled(), r.deliveryFeeOrZero(), r.getDeliveryMinOrder(),
                r.deliveryRunTimes().stream().map(LocalTime::toString).toList(), r.deliveryCutoffOrDefault(),
                r.getDeliveryLocationIds().stream().sorted().toList());
    }

    @Transactional
    public Settings saveSettings(Long restaurantId, Settings s) {
        Restaurant r = restaurants.getActive(restaurantId);
        List<LocalTime> runs = parseRuns(s.runs());
        Set<Long> known = locations.findAll().stream().map(DeliveryLocation::getId).collect(Collectors.toSet());
        Set<Long> chosen = new HashSet<>(s.locationIds() == null ? List.of() : s.locationIds());
        chosen.retainAll(known);
        if (s.enabled() && runs.isEmpty()) {
            throw ApiException.badRequest("Add at least one delivery time");
        }
        if (s.enabled() && chosen.isEmpty()) {
            throw ApiException.badRequest("Choose at least one building you deliver to");
        }
        r.setDeliveryEnabled(s.enabled());
        r.setDeliveryFee(s.fee() == null ? BigDecimal.ZERO : s.fee());
        r.setDeliveryMinOrder(s.minOrder() == null || s.minOrder().signum() == 0 ? null : s.minOrder());
        r.setDeliveryRuns(runs.stream().map(LocalTime::toString).collect(Collectors.joining(",")));
        r.setDeliveryCutoffMinutes(s.cutoffMinutes());
        r.getDeliveryLocationIds().clear();
        r.getDeliveryLocationIds().addAll(chosen);
        return settings(restaurantId);
    }

    private static List<LocalTime> parseRuns(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        try {
            List<LocalTime> runs = raw.stream().filter(t -> t != null && !t.isBlank())
                    .map(t -> LocalTime.parse(t.trim()).withSecond(0).withNano(0)).distinct().sorted().toList();
            if (runs.size() > MAX_RUNS) {
                throw ApiException.badRequest("At most " + MAX_RUNS + " delivery times a day");
            }
            return runs;
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("Delivery times must look like 12:45");
        }
    }

    // ---------------------------------------------------------------- order check (Order Service)

    /** Checks a delivery order can be taken for this building and run, and returns the fee. */
    public Quote quote(Long restaurantId, Long locationId, String run) {
        Restaurant r = restaurants.getActive(restaurantId);
        if (!r.isDeliveryEnabled()) {
            throw ApiException.badRequest(r.getName() + " is not delivering right now. Choose pickup instead.");
        }
        DeliveryLocation place = locations.findById(locationId).filter(DeliveryLocation::isActive)
                .orElseThrow(() -> ApiException.badRequest("Choose a building to deliver to"));
        if (!r.getDeliveryLocationIds().contains(place.getId())) {
            throw ApiException.badRequest(r.getName() + " does not deliver to " + place.getName());
        }
        LocalTime time;
        try {
            time = LocalTime.parse(run);
        } catch (DateTimeParseException | NullPointerException e) {
            throw ApiException.badRequest("Choose a delivery time");
        }
        if (!r.deliveryRunTimes().contains(time)) {
            throw ApiException.badRequest(r.getName() + " has no delivery at " + time);
        }
        LocalDateTime runAt = LocalDate.now().atTime(time);
        LocalDateTime closes = runAt.minusMinutes(r.deliveryCutoffOrDefault());
        if (LocalDateTime.now().isAfter(closes)) {
            throw ApiException.badRequest("Orders for the " + time + " delivery closed at " + closes.toLocalTime()
                    + ". Choose a later time or pickup.");
        }
        return new Quote(r.deliveryFeeOrZero(), r.getDeliveryMinOrder(), place.getName(), runAt);
    }
}
