package com.campusfood.restaurant.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.campusfood.restaurant.client.NotificationClient;
import com.campusfood.restaurant.client.OrderClient;
import com.campusfood.restaurant.domain.Dish;
import com.campusfood.restaurant.domain.DishRepository;
import com.campusfood.restaurant.domain.Restaurant;
import com.campusfood.restaurant.domain.RestaurantRepository;

class DailyRoutineServiceTest {

    private final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    private final DishRepository dishes = mock(DishRepository.class);
    private final MenuService menus = mock(MenuService.class);
    private final CounterSaleService counterSales = mock(CounterSaleService.class);
    private final OrderClient orders = mock(OrderClient.class);
    private final NotificationClient notifications = mock(NotificationClient.class);
    private final DailyRoutineService routine =
            new DailyRoutineService(restaurants, dishes, menus, counterSales, orders, notifications);
    private Restaurant canteen;

    @BeforeEach
    void setUp() {
        canteen = new Restaurant();
        canteen.setId(4L);
        canteen.setName("Main Canteen");
        when(restaurants.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(canteen));
        when(restaurants.markAutoOpened(anyLong(), any())).thenReturn(1);
        when(counterSales.summary(anyLong(), any()))
                .thenReturn(new CounterSaleService.Summary(LocalDate.now(), 22, new BigDecimal("2420"), List.of()));
        when(orders.daySummary(anyLong(), any())).thenReturn(new OrderClient.DaySummary(LocalDate.now(), 45,
                Map.of("COLLECTED", 40L, "NO_SHOW", 3L), new BigDecimal("2400.00")));
    }

    @Test
    void morningCopiesTheLastDaysMenuWhenTodaysIsEmpty() {
        canteen.setAutoOpenTime(LocalTime.now().minusMinutes(1));
        when(dishes.findByRestaurantIdAndAvailableDateAndDeletedFalse(eq(4L), any())).thenReturn(List.of());

        routine.run();

        verify(menus).copyLastDay(4L);
        verify(restaurants).markAutoOpened(4L, LocalDate.now());
    }

    @Test
    void morningKeepsAMenuTheOwnerAlreadySet() {
        canteen.setAutoOpenTime(LocalTime.now().minusMinutes(1));
        when(dishes.findByRestaurantIdAndAvailableDateAndDeletedFalse(eq(4L), any())).thenReturn(List.of(new Dish()));

        routine.run();

        verify(menus, never()).copyLastDay(anyLong());
        verify(restaurants).markAutoOpened(4L, LocalDate.now());
    }

    @Test
    void doesNotOpenBeforeItsTimeOrTwiceADay() {
        canteen.setAutoOpenTime(LocalTime.now().plusMinutes(30));
        routine.run();
        canteen.setAutoOpenTime(LocalTime.now().minusMinutes(1));
        canteen.setLastAutoOpenedOn(LocalDate.now());
        routine.run();

        verify(restaurants, never()).markAutoOpened(anyLong(), any());
    }

    @Test
    void eveningSummaryShowsCashPlatesAndNoShows() {
        canteen.setAutoCloseTime(LocalTime.now().minusMinutes(1));

        routine.run();

        ArgumentCaptor<NotificationClient.Event> sent = ArgumentCaptor.forClass(NotificationClient.Event.class);
        verify(notifications).notify(sent.capture());
        NotificationClient.Event e = sent.getValue();
        assertEquals("DAY_SUMMARY", e.type());
        assertEquals(List.of("restaurant:4"), e.channels());
        assertEquals("Today: ₹4820 cash in box", e.title());
        assertTrue(e.message().startsWith("40 app orders + 22 walk-in plates · 3 no-shows"), e.message());
        verify(restaurants).markSummarySent(4L, LocalDate.now());
    }

    @Test
    void noSummaryOnADayWithoutSales() {
        canteen.setAutoCloseTime(LocalTime.now().minusMinutes(1));
        when(counterSales.summary(anyLong(), any()))
                .thenReturn(new CounterSaleService.Summary(LocalDate.now(), 0, BigDecimal.ZERO, List.of()));
        when(orders.daySummary(anyLong(), any()))
                .thenReturn(new OrderClient.DaySummary(LocalDate.now(), 0, Map.of(), BigDecimal.ZERO));

        routine.run();

        verify(notifications, never()).notify(any());
        verify(restaurants).markSummarySent(4L, LocalDate.now());
    }
}
