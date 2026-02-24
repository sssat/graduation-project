// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/LogoutDto.java
package com.newsight.backend.accounts.presentation.dto;

/**
 * /api/auth/logout/
 */
public final class LogoutDto {

    private LogoutDto() {}

    public record LogoutResponseDto(String message) {
        public static LogoutResponseDto defaultSuccess() {
            return new LogoutResponseDto("로그아웃되었습니다.");
        }
    }
}