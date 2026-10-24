package com.campusfood.restaurant.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.campusfood.restaurant.common.ApiException;

/**
 * Dish and restaurant photos taken on the owner's phone. The phone shrinks each photo before
 * uploading; here we only check it really is a JPEG / PNG / WebP image (by its first bytes, not by
 * what the browser claims), give it a random name and keep it on the server's disk.
 */
@Service
public class PhotoService {

    /** Names we hand out ourselves – anything else (e.g. "../") is refused when reading. */
    private static final Pattern NAME = Pattern.compile("^[a-f0-9]{32}\\.(jpg|png|webp)$");
    private static final long MAX_BYTES = 3 * 1024 * 1024;

    private final Path dir;

    public PhotoService(@Value("${app.photos.dir}") String dir) throws IOException {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
    }

    /** Saves the photo and returns the address the app uses to show it. */
    public String save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose a photo first");
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("This photo is too large (max 3 MB)");
        }
        try {
            byte[] bytes = file.getBytes();
            String ext = typeOf(bytes);
            if (ext == null) {
                throw ApiException.badRequest("Only JPG, PNG or WebP photos can be added");
            }
            String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
            Files.write(dir.resolve(name), bytes);
            return "/api/photos/" + name;
        } catch (IOException e) {
            throw new IllegalStateException("Could not save the photo", e);
        }
    }

    /** The stored file, or 404 for unknown or invalid names. */
    public Path find(String name) {
        Path file = NAME.matcher(name).matches() ? dir.resolve(name) : null;
        if (file == null || !Files.isRegularFile(file)) {
            throw ApiException.notFound("Photo not found");
        }
        return file;
    }

    public static MediaType mediaType(String name) {
        if (name.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (name.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    private static String typeOf(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (b.length > 8 && Arrays.equals(Arrays.copyOf(b, 8), new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})) {
            return "png";
        }
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "webp";
        }
        return null;
    }
}
