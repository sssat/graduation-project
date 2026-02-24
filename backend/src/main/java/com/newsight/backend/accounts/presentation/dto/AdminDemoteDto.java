// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/AdminDemoteDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * /api/admins/demote/
 */
public final class AdminDemoteDto {

    private AdminDemoteDto() {}

    public record AdminDemoteRequestDto(
            @JsonProperty("user_seq")
            Long userSeq
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AdminDemoteResponseDto(
            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("acted_seq")
            Long actedSeq,

            @JsonProperty("demoted_at")
            LocalDateTime demotedAt,

            String message
    ) {
        public static AdminDemoteResponseDto success(
                Long userSeq,
                Long actedSeq,
                LocalDateTime demotedAt,
                String message
        ) {
            return new AdminDemoteResponseDto(userSeq, actedSeq, demotedAt, message);
        }

        public static AdminDemoteResponseDto failure(String message) {
            return new AdminDemoteResponseDto(null, null, null, message);
        }
    }
}