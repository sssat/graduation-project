// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/IdPrecheckDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/register/precheck/user-id/
 */
public final class IdPrecheckDto {

    private IdPrecheckDto() {}

    public record IdPrecheckRequestDto(
            @JsonProperty("user_id")
            String userId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserIdInfo(
            boolean valid,
            String status // available | invalid | taken
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IdPrecheckResponseDto(
            @JsonProperty("user_id")
            UserIdInfo userId,

            @JsonProperty("id_check_token")
            String idCheckToken,

            @JsonProperty("expires_in")
            Integer expiresIn
    ) {}

    public static IdPrecheckResponseDto success(String status, String token, Integer expiresIn) {
        return new IdPrecheckResponseDto(new UserIdInfo(true, status), token, expiresIn);
    }

    public static IdPrecheckResponseDto invalid() {
        return new IdPrecheckResponseDto(new UserIdInfo(false, "invalid"), null, null);
    }

    public static IdPrecheckResponseDto taken() {
        return new IdPrecheckResponseDto(new UserIdInfo(true, "taken"), null, null);
    }
}