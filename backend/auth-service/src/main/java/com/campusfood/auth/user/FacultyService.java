package com.campusfood.auth.user;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.campusfood.auth.common.ApiException;
import com.campusfood.auth.common.Notices;

/**
 * Faculty verification: a user sends their department, delivery place and a photo of their
 * college ID; the admin looks at the photo and approves or rejects. ID photos are personal data,
 * so they are kept in a private folder (never served publicly) and deleted once the admin decides.
 */
@Service
public class FacultyService {

    private static final Logger log = LoggerFactory.getLogger(FacultyService.class);
    private static final Pattern NAME = Pattern.compile("^[a-f0-9]{32}\\.(jpg|png|webp)$");
    private static final long MAX_BYTES = 3 * 1024 * 1024;

    private final UserRepository users;
    private final Path dir;
    private final Notices notices;

    public FacultyService(UserRepository users, @Value("${app.faculty.id-photo-dir}") String dir, Notices notices)
            throws IOException {
        this.users = users;
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        this.notices = notices;
        Files.createDirectories(this.dir);
    }

    public record FacultyRequest(Long userId, String name, String email, String phone, String department,
                                 Long deliveryLocationId, String deliveryRoom, LocalDateTime requestedAt,
                                 boolean hasIdPhoto) {
    }

    /** Delivery details the Order Service needs before accepting a delivery order. */
    public record DeliveryProfile(boolean faculty, String name, String phone, String department,
                                  Long deliveryLocationId, String deliveryRoom) {
    }

    // ---------------------------------------------------------------- user

    @Transactional
    public UserDto request(Long userId, String department, Long locationId, String room, MultipartFile idPhoto) {
        User u = get(userId);
        if (u.getRole() != Role.STUDENT) {
            throw ApiException.badRequest("Only student/faculty accounts can ask for faculty delivery");
        }
        if (u.facultyStatus() == FacultyStatus.APPROVED) {
            throw ApiException.conflict("You are already approved as faculty");
        }
        String photo = savePhoto(idPhoto);
        deletePhoto(u.getFacultyIdPhoto());
        u.setDepartment(department.trim());
        u.setDeliveryLocationId(locationId);
        u.setDeliveryRoom(room.trim());
        u.setFacultyIdPhoto(photo);
        u.setFacultyNote(null);
        u.setFacultyStatus(FacultyStatus.PENDING);
        u.setFacultyRequestedAt(LocalDateTime.now());
        notices.toAdmin("FACULTY_REQUEST", "Faculty request from " + u.getName(), department.trim());
        return UserDto.of(u);
    }

    /** "I am faculty" tapped: remember it so the app keeps reminding them to verify. Still a student until approved. */
    @Transactional
    public UserDto markIntent(Long userId) {
        User u = get(userId);
        if (u.getRole() != Role.STUDENT) {
            throw ApiException.badRequest("Only student/faculty accounts can ask for faculty delivery");
        }
        if (u.facultyStatus() == FacultyStatus.NONE || u.facultyStatus() == FacultyStatus.REJECTED) {
            u.setFacultyStatus(FacultyStatus.NOT_VERIFIED);
        }
        return UserDto.of(u);
    }

    /** "I'm not faculty" – stop the reminder (only before an ID was sent). */
    @Transactional
    public UserDto clearIntent(Long userId) {
        User u = get(userId);
        if (u.facultyStatus() == FacultyStatus.NOT_VERIFIED) {
            u.setFacultyStatus(FacultyStatus.NONE);
        }
        return UserDto.of(u);
    }

    /** Faculty (approved or waiting) move to another room or building – no new approval needed. */
    @Transactional
    public UserDto changePlace(Long userId, Long locationId, String room) {
        User u = get(userId);
        if (u.facultyStatus() != FacultyStatus.APPROVED && u.facultyStatus() != FacultyStatus.PENDING) {
            throw ApiException.conflict("Ask for faculty delivery first");
        }
        u.setDeliveryLocationId(locationId);
        u.setDeliveryRoom(room.trim());
        return UserDto.of(u);
    }

    public DeliveryProfile deliveryProfile(Long userId) {
        User u = get(userId);
        return new DeliveryProfile(u.isFaculty() && !u.isBlocked(), u.getName(), u.getPhone(), u.getDepartment(),
                u.getDeliveryLocationId(), u.getDeliveryRoom());
    }

    // ---------------------------------------------------------------- admin

    public List<FacultyRequest> pending() {
        return users.findByFacultyStatusOrderByFacultyRequestedAtAsc(FacultyStatus.PENDING).stream()
                .map(u -> new FacultyRequest(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getDepartment(),
                        u.getDeliveryLocationId(), u.getDeliveryRoom(), u.getFacultyRequestedAt(),
                        u.getFacultyIdPhoto() != null))
                .toList();
    }

    public Path idPhoto(Long userId) {
        String name = get(userId).getFacultyIdPhoto();
        Path file = name != null && NAME.matcher(name).matches() ? dir.resolve(name) : null;
        if (file == null || !Files.isRegularFile(file)) {
            throw ApiException.notFound("No ID photo");
        }
        return file;
    }

    @Transactional
    public UserDto approve(Long userId) {
        User u = pendingOrFaculty(userId);
        deletePhoto(u.getFacultyIdPhoto());
        u.setFacultyIdPhoto(null);
        u.setFacultyNote(null);
        u.setFacultyStatus(FacultyStatus.APPROVED);
        notices.toUser(u.getId(), "FACULTY_APPROVED", "You're approved as faculty",
                "Your food can now be delivered. Choose Delivery when you order.");
        return UserDto.of(u);
    }

    /** Turns a request down – or removes faculty delivery from someone already approved. */
    @Transactional
    public UserDto reject(Long userId, String reason) {
        User u = pendingOrFaculty(userId);
        deletePhoto(u.getFacultyIdPhoto());
        u.setFacultyIdPhoto(null);
        u.setFacultyNote(reason == null || reason.isBlank() ? null : reason.trim());
        u.setFacultyStatus(FacultyStatus.REJECTED);
        notices.toUser(u.getId(), "FACULTY_REJECTED", "Faculty delivery not approved",
                u.getFacultyNote() == null ? "Contact the canteen office for details." : u.getFacultyNote());
        return UserDto.of(u);
    }

    private User get(Long userId) {
        return users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private User pendingOrFaculty(Long userId) {
        User u = get(userId);
        if (u.facultyStatus() != FacultyStatus.PENDING && u.facultyStatus() != FacultyStatus.APPROVED) {
            throw ApiException.conflict(u.getName() + " has no faculty request");
        }
        return u;
    }

    // ---------------------------------------------------------------- ID photo files

    private String savePhoto(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Add a photo of your college ID card");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("The ID photo is too large (max 3 MB)");
        }
        try {
            byte[] bytes = file.getBytes();
            String ext = imageType(bytes);
            if (ext == null) {
                throw ApiException.badRequest("The ID photo must be a JPG, PNG or WebP picture");
            }
            String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
            Files.write(dir.resolve(name), bytes);
            return name;
        } catch (IOException e) {
            throw new IllegalStateException("Could not save the ID photo", e);
        }
    }

    private void deletePhoto(String name) {
        if (name == null || !NAME.matcher(name).matches()) {
            return;
        }
        try {
            Files.deleteIfExists(dir.resolve(name));
        } catch (IOException e) {
            log.warn("Could not delete ID photo {}: {}", name, e.getMessage());
        }
    }

    /** Checks the first bytes, not what the browser claims. */
    static String imageType(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (b.length > 8 && Arrays.equals(Arrays.copyOf(b, 8),
                new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})) {
            return "png";
        }
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "webp";
        }
        return null;
    }
}
