// backend/src/main/java/com/newsight/backend/accounts/infrastructure/security/JwtKeyUtil.java
package com.newsight.backend.accounts.infrastructure.security;

import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.SecretKey;

public final class JwtKeyUtil {

    private JwtKeyUtil() {}

    public static SecretKey hmacSha256Key(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("app.jwt.secret 설정이 필요합니다.");
        }
        return Keys.hmacShaKeyFor(normalizeSecretBytes(secret));
    }

    /**
     * HS256용 키 바이트를 안전하게 생성한다.
     * - secret이 Base64일 가능성도 있어 디코딩을 한번 시도
     * - 길이가 짧으면 SHA-256으로 보정(32바이트 확보)
     */
    public static byte[] normalizeSecretBytes(String secret) {
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);

        byte[] decoded = tryBase64Decode(secret);
        if (decoded != null && decoded.length > 0) {
            raw = decoded;
        }

        if (raw.length >= 32) return raw;

        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return sha.digest(raw);
        } catch (Exception e) {
            byte[] padded = new byte[32];
            for (int i = 0; i < padded.length; i++) {
                padded[i] = raw[i % raw.length];
            }
            return padded;
        }
    }

    private static byte[] tryBase64Decode(String s) {
        try {
            return Base64.getDecoder().decode(s);
        } catch (Exception ignore) {
            return null;
        }
    }
}