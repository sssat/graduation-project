// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/ChangePasswordDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/change-password/
 */
public final class ChangePasswordDto {

    private ChangePasswordDto() {}

    public record ChangePasswordRequestDto(
            @JsonProperty("current_password")
            String currentPassword,

            @JsonProperty("new_password")
            String newPassword,

            @JsonProperty("new_password_confirm")
            String newPasswordConfirm
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChangePasswordResponseDto(
            String message,

            @JsonProperty("clear_refresh_cookie")
            Boolean clearRefreshCookie
    ) {
        public static ChangePasswordResponseDto success(String message) {
            return new ChangePasswordResponseDto(message, Boolean.TRUE);
        }

        public static ChangePasswordResponseDto failure(String message) {
            return new ChangePasswordResponseDto(message, null);
        }
    }
}