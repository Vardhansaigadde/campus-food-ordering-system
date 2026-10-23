package com.campusfood.notification.push;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUserId(Long userId);

    List<PushSubscription> findByRestaurantId(Long restaurantId);

    @Transactional
    long deleteByEndpoint(String endpoint);

    @Transactional
    long deleteByEndpointAndUserId(String endpoint, Long userId);
}
