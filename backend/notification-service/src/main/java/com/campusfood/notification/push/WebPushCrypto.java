package com.campusfood.notification.push;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Web Push with only the JDK's own crypto – no extra libraries:
 * <ul>
 *   <li>message encryption: RFC 8291 ("aes128gcm" content coding, RFC 8188)</li>
 *   <li>server identification: VAPID, RFC 8292 (an ES256-signed JWT)</li>
 * </ul>
 * Browsers (Chrome/FCM, Firefox, Safari, Edge) only accept pushes in exactly this format.
 */
public final class WebPushCrypto {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {
    }

    // ---------------------------------------------------------------- keys

    public static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return gen.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** P-256 public key as the 65-byte uncompressed point (0x04 || X || Y) browsers use. */
    public static byte[] rawPublicKey(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        copyUnsigned(key.getW().getAffineX(), out, 1);
        copyUnsigned(key.getW().getAffineY(), out, 33);
        return out;
    }

    public static byte[] rawPrivateKey(ECPrivateKey key) {
        byte[] out = new byte[32];
        copyUnsigned(key.getS(), out, 0);
        return out;
    }

    public static ECPublicKey publicKeyFromRaw(byte[] raw) {
        if (raw.length != 65 || raw[0] != 0x04) {
            throw new IllegalArgumentException("Not an uncompressed P-256 public key");
        }
        try {
            ECPoint point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33)),
                    new BigInteger(1, Arrays.copyOfRange(raw, 33, 65)));
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, p256()));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Invalid P-256 public key", e);
        }
    }

    public static ECPrivateKey privateKeyFromRaw(byte[] raw) {
        try {
            return (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), p256()));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Invalid P-256 private key", e);
        }
    }

    public static KeyPair keyPairFromRaw(byte[] rawPublic, byte[] rawPrivate) {
        return new KeyPair(publicKeyFromRaw(rawPublic), privateKeyFromRaw(rawPrivate));
    }

    public static String b64(byte[] bytes) {
        return B64.encodeToString(bytes);
    }

    public static byte[] unb64(String text) {
        return B64D.decode(text.trim().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    // ---------------------------------------------------------------- RFC 8291 encryption

    /** Encrypts a push message for one browser subscription (random server key and salt). */
    public static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(payload, uaPublic, authSecret, generateKeyPair(), salt);
    }

    /** Deterministic form, so the RFC 8291 example can be checked byte for byte in tests. */
    static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt) {
        try {
            byte[] asPublic = rawPublicKey((ECPublicKey) asKeys.getPublic());

            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(asKeys.getPrivate());
            ka.doPhase(publicKeyFromRaw(uaPublic), true);
            byte[] ecdhSecret = ka.generateSecret();

            // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
            byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic);
            byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);

            byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
            byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

            // One record: payload, then the 0x02 "last record" delimiter
            byte[] plain = concat(payload, new byte[] {2});
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] cipherText = cipher.doFinal(plain);

            // Header: salt(16) | record size(4) | key id length(1) | key id = as_public(65)
            ByteBuffer body = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length + cipherText.length);
            body.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic).put(cipherText);
            return body.array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Push encryption failed", e);
        }
    }

    // ---------------------------------------------------------------- RFC 8292 VAPID

    /** Value for the Authorization header: {@code vapid t=<jwt>, k=<public key>}. */
    public static String vapidAuthorization(String audience, String subject, KeyPair vapidKeys, long expiresAtEpochSeconds) {
        try {
            String header = b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String claims = b64(("{\"aud\":\"" + audience + "\",\"exp\":" + expiresAtEpochSeconds
                    + ",\"sub\":\"" + subject + "\"}").getBytes(StandardCharsets.UTF_8));
            String signingInput = header + "." + claims;
            // JWT wants the raw 64-byte R||S signature, not DER
            Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
            signer.initSign((PrivateKey) vapidKeys.getPrivate());
            signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            String jwt = signingInput + "." + b64(signer.sign());
            return "vapid t=" + jwt + ", k=" + b64(rawPublicKey((ECPublicKey) vapidKeys.getPublic()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID signing failed", e);
        }
    }

    // ---------------------------------------------------------------- helpers

    /** HKDF-SHA256 (RFC 5869) for outputs of at most 32 bytes – all Web Push needs. */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    private static ECParameterSpec p256() throws GeneralSecurityException {
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        return params.getParameterSpec(ECParameterSpec.class);
    }

    private static void copyUnsigned(BigInteger value, byte[] out, int offset) {
        byte[] bytes = value.toByteArray();
        int start = bytes.length > 32 ? bytes.length - 32 : 0;
        int len = bytes.length - start;
        System.arraycopy(bytes, start, out, offset + 32 - len, len);
    }

    private static byte[] concat(byte[]... parts) {
        int total = 0;
        for (byte[] p : parts) {
            total += p.length;
        }
        ByteBuffer buf = ByteBuffer.allocate(total);
        for (byte[] p : parts) {
            buf.put(p);
        }
        return buf.array();
    }
}
