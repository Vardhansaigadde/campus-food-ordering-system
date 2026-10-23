package com.campusfood.notification.web;

import java.time.LocalDateTime;

import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.notification.common.CurrentUser;
import com.campusfood.notification.common.PageResponse;
import com.campusfood.notification.domain.AuditLog;
import com.campusfood.notification.domain.AuditLogRepository;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;

/** Audit log: written by every microservice, read only by the admin. */
@Hidden
@RestController
public class AuditController {

    private final AuditLogRepository auditLog;

    public AuditController(AuditLogRepository auditLog) {
        this.auditLog = auditLog;
    }

    public record AuditEntry(Long actorId, String actorName, String actorRole, String action, String details) {
    }

    public record AuditView(Long id, String actorName, String actorRole, String action, String details,
                            LocalDateTime createdAt) {
        static AuditView of(AuditLog a) {
            return new AuditView(a.getId(), a.getActorName(), a.getActorRole(), a.getAction(), a.getDetails(),
                    a.getCreatedAt());
        }
    }

    @PostMapping("/internal/audit")
    public void record(@RequestBody AuditEntry entry) {
        AuditLog log = new AuditLog();
        log.setActorId(entry.actorId());
        log.setActorName(truncate(entry.actorName(), 80));
        log.setActorRole(truncate(entry.actorRole(), 12));
        log.setAction(truncate(entry.action() == null ? "UNKNOWN" : entry.action(), 40));
        log.setDetails(truncate(entry.details(), 400));
        auditLog.save(log);
    }

    @GetMapping("/api/admin/audit")
    public PageResponse<AuditView> list(@RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "30") int size,
                                        HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        String query = q == null || q.isBlank() ? null : q.trim();
        return PageResponse.of(auditLog.search(query, PageRequest.of(page, Math.min(size, 100))).map(AuditView::of));
    }

    private static String truncate(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
