// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/SignUpDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * /api/auth/register/
 */
public final class SignUpDto {

    private SignUpDto() {}

    public record SignUpRequestDto(
            @JsonProperty("user_id")
            String userId,

            String email,

            String password,

            @JsonProperty("password2")
            String password2,

            String username,

            @JsonProperty("birth_date")
            LocalDate birthDate,

            String gender, // "M" | "F"

            @JsonProperty("agree_whether")
            Boolean agreeWhether,

            @JsonProperty("id_check_token")
            String idCheckToken,

            @JsonProperty("email_check_token")
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