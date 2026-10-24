package com.campusfood.restaurant.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryLocationRepository extends JpaRepository<DeliveryLocation, Long> {

    List<DeliveryLocation> findAllByOrderByNameAsc();

    List<DeliveryLocation> findByActiveTrueOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
