// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/FindPasswordDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * /api/auth/find-password/
 */
public final class FindPasswordDto {

    private FindPasswordDto() {}

    public record FindPasswordRequestDto(
            @JsonProperty("user_id")
            String userId,
            String name,
            String email
    ) {}

    /**
     * 명세서가 "응답 없음"이라고 되어 있어도,
     * 현재 서비스 로직(임시비밀번호 안내 등) 특성상 메시지를 내려주는 편이 운영/UX에 유리해서 둔다.
     * 원하면 컨트롤러에서 ResponseEntity<Void>로 바꿔도 된다.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FindPasswordResponseDto(
            String message,
            @JsonProperty("temp_password")
            String tempPassword
    ) {
        public static FindPasswordResponseDto success(String message) {
            return new FindPasswordResponseDto(message, null);
        }

        public static FindPasswordResponseDto successWithTempPassword(String message, String tempPassword) {
            return new FindPasswordResponseDto(message, tempPassword);
        }

        public static FindPasswordResponseDto failure(String message) {
            return new FindPasswordResponseDto(message, null);
        }
    }
}