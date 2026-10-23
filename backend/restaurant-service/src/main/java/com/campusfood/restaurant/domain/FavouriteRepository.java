package com.campusfood.restaurant.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FavouriteRepository extends JpaRepository<Favourite, Long> {

    List<Favourite> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Favourite> findByUserIdAndDishId(Long userId, Long dishId);
}
