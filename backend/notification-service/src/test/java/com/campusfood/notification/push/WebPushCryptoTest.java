package com.campusfood.notification.push;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;

import org.junit.jupiter.api.Test;

class WebPushCryptoTest {

    /** The worked example from RFC 8291 section 5 must come out byte for byte. */
    @Test
    void encryptMatchesRfc8291Example() {
        byte[] payload = "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8);
        KeyPair asKeys = WebPushCrypto.keyPairFromRaw(
                WebPushCrypto.unb64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"),
                WebPushCrypto.unb64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
        byte[] uaPublic = WebPushCrypto.unb64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] authSecret = WebPushCrypto.unb64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] salt = WebPushCrypto.unb64("DGv6ra1nlYgDCS1FRnbzlw");

        byte[] body = WebPushCrypto.encrypt(payload, uaPublic, authSecret, asKeys, salt);

        assertEquals("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
                WebPushCrypto.b64(body));
    }

    @Test
    void rawKeysRoundTrip() {
        KeyPair keys = WebPushCrypto.generateKeyPair();
        byte[] raw = WebPushCrypto.rawPublicKey((ECPublicKey) keys.getPublic());
        assertEquals(65, raw.length);
        assertEquals(keys.getPublic(), WebPushCrypto.publicKeyFromRaw(raw));
    }

    @Test
    void vapidJwtIsSignedWithTheVapidKey() throws Exception {
        KeyPair keys = WebPushCrypto.generateKeyPair();
        String auth = WebPushCrypto.vapidAuthorization("https://fcm.googleapis.com", "mailto:admin@example.com", keys, 2_000_000_000L);
        assertTrue(auth.startsWith("vapid t="));
        String jwt = auth.substring("vapid t=".length(), auth.indexOf(", k="));
        String[] parts = jwt.split("\\.");
        assertEquals(3, parts.length);
        assertTrue(new String(WebPushCrypto.unb64(parts[1]), StandardCharsets.UTF_8).contains("\"aud\":\"https://fcm.googleapis.com\""));

        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(keys.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(verifier.verify(WebPushCrypto.unb64(parts[2])));
        assertEquals(WebPushCrypto.b64(WebPushCrypto.rawPublicKey((ECPublicKey) keys.getPublic())), auth.substring(auth.indexOf(", k=") + 4));
    }
}
