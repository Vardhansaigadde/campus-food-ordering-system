package com.campusfood.auth.user;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Small database changes that Hibernate's "update" mode can't make by itself. Hibernate adds a CHECK
 * constraint listing the enum values when it creates a column, so a value added later (e.g.
 * NOT_VERIFIED) would be rejected; the list is enforced in Java anyway, so the constraint is dropped.
 * Each fix checks first, so running it on every start is harmless.
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
        dropEnumChecks("users", "faculty_status");
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
