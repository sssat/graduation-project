package com.newsight.backend.common.security;

import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUserExtractor {

    private static final String USER_SEQ_CLAIM = "user_seq";
    private static final String LOGIN_REQUIRED_MESSAGE = "Login is required.";

    private CurrentUserExtractor() {}

    public static Long requireUserSeq(Jwt jwt) {
        if (jwt == null) {
            throw new AuthenticationCredentialsNotFoundException(LOGIN_REQUIRED_MESSAGE);
        }

        Long userSeq = parseLong(jwt.getClaim(USER_SEQ_CLAIM));
        if (userSeq != null) {
            return userSeq;
        }

        userSeq = parseLong(jwt.getSubject());
        if (userSeq != null) {
            return userSeq;
        }

        throw new AuthenticationCredentialsNotFoundException(LOGIN_REQUIRED_MESSAGE);
    }

    private static Long parseLong(Object value) {
        if (value instanceof Number n) {
            return n.longValue();
        }
        if (value instanceof String s) {
            try {
                return Long.parseLong(s.trim());
            } catch (NumberFormatException ignore) {
                return null;
            }
        }
        return null;
    }
}
