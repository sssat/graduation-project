// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/EmailPrecheckDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

/**
 * /api/auth/register/precheck/email/
 */
public final class EmailPrecheckDto {

    private EmailPrecheckDto() {}

    public record EmailPrecheckRequestDto(
            @NotBlank
            String email
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EmailInfo(
            boolean valid,
            String status // available | invalid | taken
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record EmailPrecheckResponseDto(
            EmailInfo email,

            @JsonProperty("email_check_token")
            String emailCheckToken,

            @JsonProperty("expires_in")
            Integer expiresIn,

            // 명세서에 없더라도 UX상 메시지를 내려주고 싶으면 사용(선택)
            String message
    ) {}

    public static EmailPrecheckResponseDto success(String status, String token, Integer expiresIn, String message) {
        return new EmailPrecheckResponseDto(new EmailInfo(true, status), token, expiresIn, message);
    }

    public static EmailPrecheckResponseDto invalid(String message) {
        return new EmailPrecheckResponseDto(new EmailInfo(false, "invalid"), null, null, message);
    }

    public static EmailPrecheckResponseDto taken(String message) {
        return new EmailPrecheckResponseDto(new EmailInfo(true, "taken"), null, null, message);
    }
}
