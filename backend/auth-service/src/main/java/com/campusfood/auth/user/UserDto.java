package com.campusfood.auth.user;

import java.time.LocalDateTime;

public record UserDto(Long id, String name, String email, String phone, Role role, Long restaurantId,
                      boolean blocked, LocalDateTime orderBanUntil, int noShowCount, int totalNoShows,
                      LocalDateTime createdAt, FacultyStatus facultyStatus, String department,
                      Long deliveryLocationId, String deliveryRoom, String facultyNote,
                      LocalDateTime facultyRequestedAt) {

    public static UserDto of(User u) {
        return new UserDto(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getRole(), u.getRestaurantId(),
                u.isBlocked(), u.getOrderBanUntil(), u.getNoShowCount(), u.getTotalNoShows(), u.getCreatedAt(),
                u.facultyStatus(), u.getDepartment(), u.getDeliveryLocationId(), u.getDeliveryRoom(),
                u.getFacultyNote(), u.getFacultyRequestedAt());
    }
}
