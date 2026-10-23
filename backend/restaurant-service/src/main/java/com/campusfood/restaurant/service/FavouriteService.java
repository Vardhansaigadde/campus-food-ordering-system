package com.campusfood.restaurant.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.restaurant.common.ApiException;
import com.campusfood.restaurant.domain.Dish;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.domain.Favourite;
import com.campusfood.restaurant.domain.FavouriteRepository;
import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantRepository;
import com.campusfood.restaurant.dto.DishView;

@Service
public class FavouriteService {

    private final FavouriteRepository favourites;
    private final DishRepository dishes;
    private final RestaurantRepository restaurants;

    public FavouriteService(FavouriteRepository favourites, DishRepository dishes, RestaurantRepository restaurants) {
        this.favourites = favourites;
        this.dishes = dishes;
        this.restaurants = restaurants;
    }

    public record FavouriteView(DishView dish, String restaurantName, boolean restaurantActive) {
    }

    public List<FavouriteView> list(Long userId) {
        List<Long> ids = favourites.findByUserIdOrderByCreatedAtDesc(userId).stream().map(Favourite::getDishId).toList();
        Map<Long, Dish> byId = dishes.findByIdInAndDeletedFalse(ids).stream()
                .collect(Collectors.toMap(Dish::getId, Function.identity()));
        Map<Long, Restaurant> rest = restaurants.findAllById(
                        byId.values().stream().map(Dish::getRestaurantId).distinct().toList()).stream()
                .collect(Collectors.toMap(Restaurant::getId, Function.identity()));
        return ids.stream()
                .filter(byId::containsKey)
                .map(byId::get)
                .filter(d -> rest.containsKey(d.getRestaurantId()))
                .map(d -> {
                    Restaurant r = rest.get(d.getRestaurantId());
                    return new FavouriteView(DishView.forStudent(d, false), r.getName(), r.isActive());
                })
                .toList();
    }

    public List<Long> ids(Long userId) {
        return favourites.findByUserIdOrderByCreatedAtDesc(userId).stream().map(Favourite::getDishId).toList();
    }

    @Transactional
    public void add(Long userId, Long dishId) {
        dishes.findById(dishId).filter(d -> !d.isDeleted())
                .orElseThrow(() -> ApiException.notFound("Dish not found"));
        if (favourites.findByUserIdAndDishId(userId, dishId).isEmpty()) {
            favourites.save(new Favourite(userId, dishId));
        }
    }

    @Transactional
    public void remove(Long userId, Long dishId) {
        favourites.findByUserIdAndDishId(userId, dishId).ifPresent(favourites::delete);
    }
}
