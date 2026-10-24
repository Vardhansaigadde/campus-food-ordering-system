package com.campusfood.order.domain;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Small database changes that Hibernate's "update" mode can't make by itself.
 * Each one checks first, so running it on every start is harmless.
 */
@Component
public class SchemaFixes implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaFixes.class);

    private final JdbcTemplate jdbc;

    public SchemaFixes(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Older databases store the status as a MySQL ENUM, which rejects new statuses like ON_THE_WAY
        String type = jdbc.query("""
                select data_type from information_schema.columns
                where table_schema = database() and table_name = 'orders' and column_name = 'status'
                """, rs -> rs.next() ? rs.getString(1) : null);
        if ("enum".equalsIgnoreCase(type)) {
            jdbc.execute("alter table orders modify column status varchar(20) not null");
            log.info("orders.status changed from ENUM to VARCHAR(20)");
        }
    }
}
