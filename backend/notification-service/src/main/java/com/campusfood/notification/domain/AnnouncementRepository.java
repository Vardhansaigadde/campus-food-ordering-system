package com.campusfood.notification.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    List<Announcement> findByActiveTrueOrderByCreatedAtDesc();

    List<Announcement> findTop50ByOrderByCreatedAtDesc();
}
