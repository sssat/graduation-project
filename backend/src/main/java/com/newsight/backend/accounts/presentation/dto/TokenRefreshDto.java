// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/TokenRefreshDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/refresh/
 * - 일반적으로 refresh는 쿠키로 들어오고, 응답은 access만 내려준다.
 */
public final class TokenRefreshDto {

    private TokenRefreshDto() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TokenRefreshResponseDto(
            @JsonProperty("access")
            String access,

            @JsonProperty("message")
            String message
    ) {
        public static TokenRefreshResponseDto success(String access) {
            return new TokenRefreshResponseDto(access, null);
        }

        public static TokenRefreshResponseDto failure(String message) {
            return new TokenRefreshResponseDto(null, message);
        }
    }
}