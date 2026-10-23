package com.campusfood.restaurant.web;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.restaurant.common.CurrentUser;
import com.campusfood.restaurant.service.FavouriteService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/favourites")
@Tag(name = "Favourites (student)")
public class FavouriteController {

    private final FavouriteService favourites;

    public FavouriteController(FavouriteService favourites) {
        this.favourites = favourites;
    }

    @GetMapping
    public List<FavouriteService.FavouriteView> list(HttpServletRequest request) {
        return favourites.list(CurrentUser.from(request).requireStudent().id());
    }

    @GetMapping("/ids")
    public List<Long> ids(HttpServletRequest request) {
        return favourites.ids(CurrentUser.from(request).requireStudent().id());
    }

    @PostMapping("/{dishId}")
    public void add(@PathVariable Long dishId, HttpServletRequest request) {
        favourites.add(CurrentUser.from(request).requireStudent().id(), dishId);
    }

    @DeleteMapping("/{dishId}")
    public void remove(@PathVariable Long dishId, HttpServletRequest request) {
        favourites.remove(CurrentUser.from(request).requireStudent().id(), dishId);
    }
}
