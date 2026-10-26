package com.campusfood.order.domain;

import java.util.List;

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
        // Hibernate adds a CHECK listing the enum values when it creates a column; a value added later
        // (a new status, or e.g. a drop-point fulfilment) would be rejected. Java enforces the values anyway.
        dropEnumChecks("orders", "status");
        dropEnumChecks("orders", "fulfilment");
    }

    private void dropEnumChecks(String table, String column) {
        List<String> names = jdbc.queryForList("""
                select tc.constraint_name from information_schema.table_constraints tc
                join information_schema.check_constraints cc
                  on cc.constraint_schema = tc.constraint_schema and cc.constraint_name = tc.constraint_name
                where tc.table_schema = database() and tc.table_name = ? and tc.constraint_type = 'CHECK'
                  and cc.check_clause like ?
                """, String.class, table, "%" + column + "%");
        for (String name : names) {
            jdbc.execute("alter table " + table + " drop check `" + name.replace("`", "") + "`");
            log.info("Dropped check constraint {} on {}.{}", name, table, column);
        }
    }
}
