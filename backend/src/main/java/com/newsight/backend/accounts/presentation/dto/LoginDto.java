// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/LoginDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/login/
 * - refresh 토큰은 보통 HttpOnly 쿠키로 내려주므로 응답 DTO에는 access만 둔다.
 */
public final class LoginDto {

    private LoginDto() {}

    public record LoginRequestDto(
            @JsonProperty("user_id")
            String userId,
            String password
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoginResponseDto(
            String access,
            String role,

            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("user_id")
            String userId,

            // 선택: 메시지 쓰고 싶으면
            String message
    ) {}
}