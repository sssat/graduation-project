package com.newsight.backend.accounts.presentation;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.http.ResponseCookie;

final class AccountControllerSupport {

    static final String REFRESH_COOKIE_NAME = "refresh";

    private AccountControllerSupport() {}

    static ResponseCookie buildRefreshCookie(String refreshToken, HttpServletRequest request, int refreshMinutes) {
        long maxAgeSec = Math.max(60L, Duration.ofMinutes(Math.max(1, refreshMinutes)).toSeconds());
        boolean secure = isHttps(request);
        String sameSite = secure ? "None" : "Lax";

        return ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken == null ? "" : refreshToken)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/api/auth")
                .maxAge(maxAgeSec)
                .build();
    }

    static ResponseCookie clearRefreshCookie(HttpServletRequest request) {
        boolean secure = isHttps(request);
        String sameSite = secure ? "None" : "Lax";

        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/api/auth")
                .maxAge(0)
                .build();
    }

    static String readCookie(HttpServletRequest request, String name) {
        if (request == null || name == null) {
            return null;
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookie != null && name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    static String extractClientIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }

        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = xff.split(",")[0].trim();
            if (!first.isBlank()) {
                return first;
            }
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr() == null ? "" : request.getRemoteAddr();
    }

    private static boolean isHttps(HttpServletRequest request) {
        if (request == null) {
            return false;
        }

        String xfProto = request.getHeader("X-Forwarded-Proto");
        if (xfProto != null && xfProto.equalsIgnoreCase("https")) {
            return true;
        }

        return request.isSecure();
    }
}
