package com.campusfood.order.common;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Sends "who changed what" entries to the Notification Service, which stores the audit log. */
@FeignClient(name = "notification-service", contextId = "auditClient")
public interface AuditClient {

    @PostMapping("/internal/audit")
    void record(@RequestBody AuditEntry entry);

    record AuditEntry(Long actorId, String actorName, String actorRole, String action, String details) {
    }
}
