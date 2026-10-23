package com.campusfood.auth.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/** Best-effort audit logging: runs in the background and never breaks the main request. */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditClient auditClient;

    public AuditService(AuditClient auditClient) {
        this.auditClient = auditClient;
    }

    @Async
    public void record(CurrentUser actor, String action, String details) {
        try {
            auditClient.record(new AuditClient.AuditEntry(
                    actor == null ? null : actor.id(),
                    actor == null ? "system" : actor.name(),
                    actor == null ? "SYSTEM" : actor.role(),
                    action, details));
        } catch (Exception e) {
            log.warn("Audit log not saved ({}): {}", action, e.getMessage());
        }
    }
}
