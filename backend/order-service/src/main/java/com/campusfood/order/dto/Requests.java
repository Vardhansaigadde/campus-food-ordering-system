package com.campusfood.order.dto;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class Requests {

    private Requests() {
    }

    public record OrderLine(@NotNull Long dishId, @Min(1) @Max(7) int quantity) {
    }

    /**
     * Prices are NOT part of the request: the server takes them from the Restaurant Service.
     * {@code pickupTime} empty = as soon as possible; otherwise a pre-order for later today.
     */
    public record PlaceOrder(@NotNull Long restaurantId,
                             @NotEmpty @Size(max = 30) List<@Valid OrderLine> items,
                             LocalDateTime pickupTime,
                             @Size(max = 150) String note,
                             @Valid Delivery delivery) {
    }

    /** Faculty only: deliver to this building and room on the run at {@code run} ("12:45") today. */
    public record Delivery(@NotNull Long locationId,
                           @Size(max = 30) String room,
                           @NotNull @Pattern(regexp = "^[0-9]{2}:[0-9]{2}$", message = "must look like 12:45") String run) {
    }

    public record StartRun(@NotNull @Pattern(regexp = "^[0-9]{2}:[0-9]{2}$", message = "must look like 12:45") String run) {
    }

    public record DishStars(@NotNull Long dishId, @Min(1) @Max(5) int stars) {
    }

    public record Rate(@NotNull @Min(1) @Max(5) Integer rating,
                       List<@Valid DishStars> dishes,
                       @Size(max = 300) String review) {
    }

    public record Reject(@NotBlank @Size(max = 150) String reason) {
    }

    /** What the student says at the counter. */
    public record Verify(@NotBlank @Size(max = 12) String token,
                         @NotBlank @Pattern(regexp = "^[0-9]{4}$", message = "must be 4 digits") String otp) {
    }

    public record VerifyQr(@NotBlank @Size(max = 64) String code) {
    }
}
