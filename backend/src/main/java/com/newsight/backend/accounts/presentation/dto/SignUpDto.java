// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/SignUpDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * /api/auth/register/
 */
public final class SignUpDto {

    private SignUpDto() {}

    public record SignUpRequestDto(
            @JsonProperty("user_id")
            @NotBlank
            String userId,

            @NotBlank
            String email,

            @NotBlank
            String password,

            @JsonProperty("password2")
            @NotBlank
            String password2,

            @NotBlank
            String username,

            @JsonProperty("birth_date")
            @NotNull
            LocalDate birthDate,

            @NotBlank
            String gender, // "M" | "F"

            @JsonProperty("agree_whether")
            @NotNull
            Boolean agreeWhether,

            @JsonProperty("id_check_token")
            @NotBlank
            String idCheckToken,

            @JsonProperty("email_check_token")
            @NotBlank
            String emailCheckToken
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SignUpResponseDto(
            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("joined_at")
            LocalDateTime joinedAt
    ) {
        public static SignUpResponseDto of(Long userSeq, LocalDateTime joinedAt) {
            return new SignUpResponseDto(userSeq, joinedAt);
        }
    }
}
