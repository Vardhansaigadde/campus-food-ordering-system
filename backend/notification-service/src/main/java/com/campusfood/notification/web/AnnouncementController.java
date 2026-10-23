package com.campusfood.notification.web;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.campusfood.notification.common.ApiException;
import com.campusfood.notification.common.CurrentUser;
import com.campusfood.notification.domain.Announcement;
import com.campusfood.notification.domain.AnnouncementRepository;
import com.campusfood.notification.domain.AuditLog;
import com.campusfood.notification.domain.AuditLogRepository;
import com.campusfood.notification.live.LiveHub;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@Tag(name = "Announcements")
public class AnnouncementController {

    private final AnnouncementRepository announcements;
    private final AuditLogRepository auditLog;
    private final LiveHub hub;

    public AnnouncementController(AnnouncementRepository announcements, AuditLogRepository auditLog, LiveHub hub) {
        this.announcements = announcements;
        this.auditLog = auditLog;
        this.hub = hub;
    }

    public record AnnouncementView(Long id, String message, String level, boolean active, LocalDateTime expiresAt,
                                   LocalDateTime createdAt) {
        static AnnouncementView of(Announcement a) {
            return new AnnouncementView(a.getId(), a.getMessage(), a.getLevel(), a.isVisible(), a.getExpiresAt(),
                    a.getCreatedAt());
        }
    }

    public record NewAnnouncement(@NotBlank @Size(max = 300) String message,
                                  @Pattern(regexp = "INFO|WARNING|SUCCESS") String level,
                                  @Future LocalDateTime expiresAt) {
    }

    @GetMapping("/api/announcements/active")
    @Operation(summary = "Banners currently shown to everyone")
    public List<AnnouncementView> active() {
        return announcements.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(Announcement::isVisible).map(AnnouncementView::of).toList();
    }

    // ---------------------------------------------------------------- admin

    @Hidden
    @GetMapping("/api/admin/announcements")
    public List<AnnouncementView> all(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return announcements.findTop50ByOrderByCreatedAtDesc().stream().map(AnnouncementView::of).toList();
    }

    @Hidden
    @PostMapping("/api/admin/announcements")
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementView create(@Valid @RequestBody NewAnnouncement body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        Announcement a = new Announcement();
        a.setMessage(body.message().trim());
        a.setLevel(body.level() == null ? "INFO" : body.level());
        a.setExpiresAt(body.expiresAt());
        a.setCreatedBy(admin.name());
        announcements.save(a);
        audit(admin, "ANNOUNCEMENT_POSTED", a.getMessage());
        hub.publish(List.of("all"), Map.of("type", "ANNOUNCEMENT", "title", "Announcement",
                "message", a.getMessage(), "data", Map.of("level", a.getLevel())));
        return AnnouncementView.of(a);
    }

    @Hidden
    @DeleteMapping("/api/admin/announcements/{id}")
    @Transactional
    public void remove(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        Announcement a = announcements.findById(id).orElseThrow(() -> ApiException.notFound("Announcement not found"));
        a.setActive(false);
        audit(admin, "ANNOUNCEMENT_REMOVED", a.getMessage());
        hub.publish(List.of("all"), Map.of("type", "ANNOUNCEMENT_REMOVED", "title", "", "message", "",
                "data", Map.of("id", id)));
    }

    private void audit(CurrentUser admin, String action, String details) {
        AuditLog log = new AuditLog();
        log.setActorId(admin.id());
        log.setActorName(admin.name());
        log.setActorRole(admin.role());
        log.setAction(action);
        log.setDetails(details);
        auditLog.save(log);
    }
}
