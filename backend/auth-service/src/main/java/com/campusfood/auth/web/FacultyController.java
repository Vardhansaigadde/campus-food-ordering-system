package com.campusfood.auth.web;

import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.campusfood.auth.common.ApiException;
import com.campusfood.auth.common.AuditService;
import com.campusfood.auth.common.CurrentUser;
import com.campusfood.auth.user.FacultyService;
import com.campusfood.auth.user.UserDto;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Faculty delivery accounts: the user's request (with a college ID photo), the admin's review,
 * and the delivery details the Order Service reads before accepting a delivery order.
 */
@Hidden
@RestController
public class FacultyController {

    private final FacultyService faculty;
    private final AuditService audit;

    public FacultyController(FacultyService faculty, AuditService audit) {
        this.faculty = faculty;
        this.audit = audit;
    }

    public record PlaceRequest(@NotNull Long deliveryLocationId, @NotBlank @Size(max = 30) String deliveryRoom) {
    }

    public record RejectRequest(@Size(max = 150) String reason) {
    }

    // ---------------------------------------------------------------- the user

    @PostMapping(path = "/api/auth/faculty", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDto request(@RequestParam String department, @RequestParam Long deliveryLocationId,
                           @RequestParam String deliveryRoom, @RequestParam("idPhoto") MultipartFile idPhoto,
                           HttpServletRequest request) {
        if (department.isBlank() || department.length() > 60) {
            throw ApiException.badRequest("Enter your department (max 60 letters)");
        }
        if (deliveryRoom.isBlank() || deliveryRoom.length() > 30) {
            throw ApiException.badRequest("Enter your room (max 30 letters)");
        }
        return faculty.request(CurrentUser.from(request).id(), department, deliveryLocationId, deliveryRoom, idPhoto);
    }

    @PutMapping("/api/auth/faculty/place")
    public UserDto changePlace(@Valid @RequestBody PlaceRequest body, HttpServletRequest request) {
        return faculty.changePlace(CurrentUser.from(request).id(), body.deliveryLocationId(), body.deliveryRoom());
    }

    // ---------------------------------------------------------------- the admin

    @GetMapping("/api/admin/users/faculty-requests")
    public List<FacultyService.FacultyRequest> pending(HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        return faculty.pending();
    }

    /** The college ID photo – admin only, never cached by the browser or a proxy. */
    @GetMapping("/api/admin/users/{id}/faculty-id-photo")
    public ResponseEntity<Resource> idPhoto(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser.from(request).requireAdmin();
        Path file = faculty.idPhoto(id);
        String name = file.getFileName().toString();
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG
                : name.endsWith(".webp") ? MediaType.parseMediaType("image/webp") : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(file));
    }

    @PostMapping("/api/admin/users/{id}/faculty/approve")
    public UserDto approve(@PathVariable Long id, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        UserDto u = faculty.approve(id);
        audit.record(admin, "FACULTY_APPROVED", u.name() + " (" + u.email() + ")");
        return u;
    }

    @PostMapping("/api/admin/users/{id}/faculty/reject")
    public UserDto reject(@PathVariable Long id, @Valid @RequestBody RejectRequest body, HttpServletRequest request) {
        CurrentUser admin = CurrentUser.from(request).requireAdmin();
        UserDto u = faculty.reject(id, body.reason());
        audit.record(admin, "FACULTY_REJECTED", u.name() + " (" + u.email() + ")"
                + (body.reason() == null || body.reason().isBlank() ? "" : ": " + body.reason().trim()));
        return u;
    }

    // ---------------------------------------------------------------- other services

    @GetMapping("/internal/users/{id}/delivery-profile")
    public FacultyService.DeliveryProfile deliveryProfile(@PathVariable Long id) {
        return faculty.deliveryProfile(id);
    }
}
