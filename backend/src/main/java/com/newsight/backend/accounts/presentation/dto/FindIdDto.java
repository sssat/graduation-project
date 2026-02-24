// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/FindIdDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/find-id/
 */
public final class FindIdDto {

    private FindIdDto() {}

    public record FindIdRequestDto(
            String email,
            String name
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FindIdResponseDto(
            @JsonProperty("user_id")
            String userId,
            String message
    ) {
        public static FindIdResponseDto success(String userId) {
            return new FindIdResponseDto(userId, null);
        }

        public static FindIdResponseDto failure(String message) {
            return new FindIdResponseDto(null, message);
        }
    }
}