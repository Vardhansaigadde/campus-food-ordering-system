package com.campusfood.restaurant.web;

import java.time.Duration;
import java.util.Map;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.service.PhotoService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Photo upload for restaurant staff (their dishes and canteen) and the admin, and the public
 * address the photos are shown from. The upload only returns the address; it is saved on the
 * dish or restaurant with the normal edit form, like any other field.
 */
@Hidden
@RestController
public class PhotoController {

    private final PhotoService photos;

    public PhotoController(PhotoService photos) {
        this.photos = photos;
    }

    @PostMapping(path = "/api/restaurant/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> uploadByStaff(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        CurrentUser.from(request).requireRestaurantId();
        return Map.of("url", photos.save(file));
    }

    @PostMapping(path = "/api/admin/restaurants/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> uploadByAdmin(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return Map.of("url", photos.save(file));
    }

    /** Public: photos are shown on the menu to everyone. Names are random, so files never change. */
    @GetMapping("/api/photos/{name}")
    public ResponseEntity<Resource> show(@PathVariable String name) {
        return ResponseEntity.ok()
                .contentType(PhotoService.mediaType(name))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(photos.find(name)));
    }
}
