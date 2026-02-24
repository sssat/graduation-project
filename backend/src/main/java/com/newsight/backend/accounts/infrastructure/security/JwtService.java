// backend/src/main/java/com/newsight/backend/accounts/infrastructure/security/JwtService.java
package com.newsight.backend.accounts.infrastructure.security;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.UserLevel;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import javax.crypto.SecretKey;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JwtService
 * - Access/Refresh JWT 발급
 * - Refresh JWT 검증 + userSeq 추출
 *
 * 전제:
 * - HS256 서명
 * - claim에 user_seq, token_type, userId, email, gradeCode 등을 포함
 * - Refresh 토큰 검증 시 token_type=refresh 강제
 */
@Component
@RequiredArgsConstructor
public class JwtService {

    private final Clock clock;

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.issuer:newsight}")
    private String issuer;

    @Value("${app.jwt.audience:newsight}")
    private String audience;

    @Value("${app.jwt.access-minutes:30}")
    private int accessMinutes;

    @Value("${app.jwt.refresh-minutes:60}")
    private int refreshMinutes;

    /**
     * userSeq를 담고 있는 클레임 키.
     * 예: user_seq
     * - subject를 쓰고 싶으면 "sub" 또는 "subject"로 설정해도 동작하도록 처리함.
     */
    @Value("${app.jwt.user-id-claim:user_seq}")
    private String userIdClaim;

    private SecretKey key;

    @PostConstruct
    void init() {
        this.key = JwtKeyUtil.hmacSha256Key(secret);
    }

    public String issueAccessToken(User user) {
        return buildToken(user, Duration.ofMinutes(Math.max(1, accessMinutes)), "access");
    }

    public String issueRefreshToken(User user) {
        return buildToken(user, Duration.ofMinutes(Math.max(1, refreshMinutes)), "refresh");
    }

    /**
     * Refresh 토큰을 검증하고 userSeq를 추출한다.
     * - "Bearer " 프리픽스가 붙어 있어도 처리
     * - token_type=refresh가 아니면 실패
     */
    public Long verifyRefreshAndGetUserSeq(String refreshJwt) {
        String jwt = stripBearer(refreshJwt);

        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(jwt);

            Claims claims = jws.getPayload();

            if (issuer != null && !issuer.isBlank()) {
                String iss = claims.getIssuer();
                if (iss == null || !issuer.equals(iss)) {
                    throw new IllegalArgumentException("issuer mismatch");
                }
            }

            if (audience != null && !audience.isBlank()) {
                Object audObj = claims.get("aud");
                if (!audienceMatches(audObj, audience)) {
                    throw new IllegalArgumentException("audience mismatch");
                }
            }

            Date exp = claims.getExpiration();
            if (exp == null || exp.toInstant().isBefore(Instant.now(clock))) {
                throw new IllegalArgumentException("token expired");
            }

            String tokenType = claims.get("token_type", String.class);
            if (!"refresh".equals(tokenType)) {
                throw new IllegalArgumentException("not a refresh token");
            }

            Object rawUserSeq;
            if ("sub".equalsIgnoreCase(userIdClaim) || "subject".equalsIgnoreCase(userIdClaim)) {
                rawUserSeq = claims.getSubject();
            } else {
                rawUserSeq = claims.get(userIdClaim);
                if (rawUserSeq == null) {
                    rawUserSeq = claims.getSubject();
                }
            }

            Long userSeq = toLong(rawUserSeq);
            if (userSeq == null || userSeq <= 0) {
                throw new IllegalArgumentException("invalid user seq");
            }

            return userSeq;

        } catch (Exception e) {
            throw new IllegalArgumentException("리프레시 토큰이 유효하지 않거나 만료되었습니다.");
        }
    }

    // ─────────────────────────────────────────────────────────
    // 내부 구현
    // ─────────────────────────────────────────────────────────

    private String buildToken(User user, Duration ttl, String tokenType) {
        if (user == null || user.getUserSeq() == null) {
            throw new IllegalArgumentException("user is required");
        }

        Instant now = Instant.now(clock);
        Instant exp = now.plus(ttl);

        Long userSeq = user.getUserSeq();
        UserLevel ul = user.getUserLevel();
        Short gradeCode = (ul == null) ? null : ul.getGradeCode();

        return Jwts.builder()
                .issuer(issuer)
                .subject(String.valueOf(userSeq))
                .audience().add(audience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claim("token_type", tokenType)
                .claim("user_seq", userSeq)
                .claim("userId", safe(user.getUserId()))
                .claim("email", safe(user.getEmail()))
                .claim("gradeCode", gradeCode == null ? 0 : gradeCode)
                // 중요: HS256 강제 (키 길이에 따라 자동으로 HS512로 바뀌는 상황 방지)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private static String stripBearer(String token) {
        if (token == null) throw new IllegalArgumentException("token required");
        String t = token.trim();
        if (t.regionMatches(true, 0, "Bearer ", 0, "Bearer ".length())) {
            return t.substring("Bearer ".length()).trim();
        }
        return t;
    }

    private static String safe(String s) {
        return (s == null) ? "" : s;
    }

    private static Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Long l) return l;
        if (v instanceof Integer i) return i.longValue();
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try {
                return Long.parseLong(s.trim());
            } catch (Exception ignore) {
                return null;
            }
        }
        return null;
    }

    private static boolean audienceMatches(Object audObj, String expected) {
        if (audObj == null) return false;

        if (audObj instanceof String s) {
            return expected.equals(s);
        }

        if (audObj instanceof Collection<?> c) {
            for (Object x : c) {
                if (x != null && expected.equals(String.valueOf(x))) return true;
            }
            return false;
        }

        return expected.equals(String.valueOf(audObj));
    }
}