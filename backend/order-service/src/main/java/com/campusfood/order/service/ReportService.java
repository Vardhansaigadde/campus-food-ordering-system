package com.campusfood.order.service;

import java.io.IOException;
import java.io.Writer;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.campusfood.order.common.ApiException;
import com.campusfood.order.domain.Order;
import com.campusfood.order.domain.OrderItem;
import com.campusfood.order.domain.OrderRepository;
import com.campusfood.order.domain.OrderStatus;

/** Summaries and charts for students, restaurants and the admin. */
@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final OrderRepository orders;

    public ReportService(OrderRepository orders) {
        this.orders = orders;
    }

    public record Count(String label, long value) {
    }

    public record Money(String label, long orders, BigDecimal revenue) {
    }

    // ---------------------------------------------------------------- restaurant end-of-day summary

    public record DaySummary(LocalDate date, long totalOrders, Map<OrderStatus, Long> byStatus,
                             BigDecimal expectedCash, List<Count> topDishes, long[] ordersByHour) {
    }

    public DaySummary daySummary(Long restaurantId, LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        LocalDateTime from = day.atStartOfDay();
        LocalDateTime to = day.plusDays(1).atStartOfDay();
        return new DaySummary(day, orders.countCreated(from, to, restaurantId), statusCounts(from, to, restaurantId),
                orders.collectedRevenue(from, to, restaurantId), topDishes(from, to, restaurantId, 5),
                byHour(from, to, restaurantId));
    }

    // ---------------------------------------------------------------- admin dashboard

    public record AdminStats(LocalDate date, long totalOrders, Map<OrderStatus, Long> byStatus, BigDecimal revenue,
                             long[] ordersByHour, List<Money> byRestaurant, List<Count> topDishes,
                             List<Money> last7Days) {
    }

    public AdminStats adminStats(LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        LocalDateTime from = day.atStartOfDay();
        LocalDateTime to = day.plusDays(1).atStartOfDay();
        List<Money> byRestaurant = orders.byRestaurant(from, to).stream()
                .map(r -> new Money((String) r[1], (Long) r[2], toMoney(r[3])))
                .toList();
        List<Money> week = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = day.minusDays(i);
            week.add(new Money(d.toString(), orders.countCreated(d.atStartOfDay(), d.plusDays(1).atStartOfDay(), null),
                    orders.collectedRevenue(d.atStartOfDay(), d.plusDays(1).atStartOfDay(), null)));
        }
        return new AdminStats(day, orders.countCreated(from, to, null), statusCounts(from, to, null),
                orders.collectedRevenue(from, to, null), byHour(from, to, null), byRestaurant,
                topDishes(from, to, null, 8), week);
    }

    // ---------------------------------------------------------------- student monthly spending

    public record MonthSummary(String month, int orders, BigDecimal spent, BigDecimal averageOrder,
                               List<Money> byRestaurant, List<Count> topDishes) {
    }

    public MonthSummary monthSummary(Long studentId, YearMonth month) {
        YearMonth m = month == null ? YearMonth.now() : month;
        List<Order> collected = orders.findByStudentIdAndStatusAndCollectedAtBetween(studentId, OrderStatus.COLLECTED,
                m.atDay(1).atStartOfDay(), m.plusMonths(1).atDay(1).atStartOfDay());
        BigDecimal spent = collected.stream().map(Order::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = collected.isEmpty() ? BigDecimal.ZERO
                : spent.divide(BigDecimal.valueOf(collected.size()), 0, java.math.RoundingMode.HALF_UP);

        Map<String, List<Order>> perRestaurant = collected.stream()
                .collect(Collectors.groupingBy(Order::getRestaurantName, LinkedHashMap::new, Collectors.toList()));
        List<Money> byRestaurant = perRestaurant.entrySet().stream()
                .map(e -> new Money(e.getKey(), e.getValue().size(),
                        e.getValue().stream().map(Order::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .sorted(Comparator.comparing(Money::revenue).reversed())
                .toList();

        Map<String, Long> dishCounts = collected.stream().flatMap(o -> o.getItems().stream())
                .collect(Collectors.groupingBy(OrderItem::getName, Collectors.summingLong(OrderItem::getQuantity)));
        List<Count> topDishes = dishCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new Count(e.getKey(), e.getValue()))
                .toList();
        return new MonthSummary(m.toString(), collected.size(), spent, average, byRestaurant, topDishes);
    }

    // ---------------------------------------------------------------- CSV export (opens in Excel)

    public void exportCsv(LocalDate from, LocalDate to, Long restaurantId, Writer out) throws IOException {
        LocalDate start = from == null ? LocalDate.now() : from;
        LocalDate end = to == null ? start : to;
        if (end.isBefore(start) || start.plusDays(92).isBefore(end)) {
            throw ApiException.badRequest("Choose a date range of up to 3 months");
        }
        out.write("Order ID,Token,Placed At,Restaurant,Student,Items,Total (Rs),Status,Pickup Time,Collected At,Rating\n");
        int page = 0;
        Page<Order> batch;
        do {
            batch = orders.search(start.atStartOfDay(), end.plusDays(1).atStartOfDay(), restaurantId, null, null,
                    PageRequest.of(page++, 500));
            for (Order o : batch) {
                String items = o.getItems().stream().map(i -> i.getQuantity() + " x " + i.getName())
                        .collect(Collectors.joining("; "));
                out.write(String.join(",", String.valueOf(o.getId()), o.getToken(), o.getCreatedAt().format(TIME),
                        csv(o.getRestaurantName()), csv(o.getStudentName()), csv(items), o.getTotal().toPlainString(),
                        o.getStatus().name(), o.getPickupTime() == null ? "ASAP" : o.getPickupTime().format(TIME),
                        o.getCollectedAt() == null ? "" : o.getCollectedAt().format(TIME),
                        o.getRating() == null ? "" : String.valueOf(o.getRating())));
                out.write("\n");
            }
        } while (batch.hasNext());
    }

    // ---------------------------------------------------------------- helpers

    private Map<OrderStatus, Long> statusCounts(LocalDateTime from, LocalDateTime to, Long rid) {
        Map<OrderStatus, Long> map = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) {
            map.put(s, 0L);
        }
        for (Object[] row : orders.countByStatus(from, to, rid)) {
            map.put((OrderStatus) row[0], (Long) row[1]);
        }
        return map;
    }

    private long[] byHour(LocalDateTime from, LocalDateTime to, Long rid) {
        long[] hours = new long[24];
        for (Object[] row : orders.ordersByHour(from, to, rid)) {
            hours[((Number) row[0]).intValue()] = ((Number) row[1]).longValue();
        }
        return hours;
    }

    private List<Count> topDishes(LocalDateTime from, LocalDateTime to, Long rid, int limit) {
        return orders.topDishes(from, to, rid, PageRequest.of(0, limit)).stream()
                .map(r -> new Count((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    private static BigDecimal toMoney(Object value) {
        return value instanceof BigDecimal b ? b : new BigDecimal(String.valueOf(value));
    }

    /** Quotes a CSV value and protects against spreadsheet formula injection. */
    private static String csv(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }
}
