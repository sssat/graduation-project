// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/AdminPromoteDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

/**
 * /api/admins/promote/
 */
public final class AdminPromoteDto {

    private AdminPromoteDto() {}

    public record AdminPromoteRequestDto(
            @JsonProperty("user_seq")
            @NotNull
            Long userSeq
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AdminPromoteResponseDto(
            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("acted_seq")
            Long actedSeq,

            @JsonProperty("admin_level")
            String adminLevel, // "ADMIN"

            @JsonProperty("granted_at")
            LocalDateTime grantedAt,

            String message
    ) {
        public static AdminPromoteResponseDto success(
                Long userSeq,
                Long actedSeq,
                String adminLevel,
                LocalDateTime grantedAt,
                String message
        ) {
            return new AdminPromoteResponseDto(userSeq, actedSeq, adminLevel, grantedAt, message);
        }

        public static AdminPromoteResponseDto failure(String message) {
            return new AdminPromoteResponseDto(null, null, null, null, message);
        }
    }
}
