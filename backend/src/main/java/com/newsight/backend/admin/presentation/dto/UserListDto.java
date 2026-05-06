// backend/src/main/java/com/newsight/backend/admin/presentation/dto/UserListDto.java
package com.newsight.backend.admin.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * /api/admins/users/
 * - 요청은 보통 QueryParam(page,size,q)로 받는다.
 */
public final class UserListDto {

    private UserListDto() {}

    public record UserListRequestDto(
            Integer page,
            Integer size,
            String q
    ) {
        public int pageOrDefault() {
            return (page == null || page < 1) ? 1 : page;
        }

        public int sizeOrDefault() {
            if (size == null) return 20;
            if (size < 1) return 1;
            return Math.min(100, size);
        }
    }

    public record UserListItemDto(
            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("user_id")
            String userId,

            @JsonProperty("user_name")
            String userName,

            @JsonProperty("grade_code")
            Integer gradeCode,

            @JsonProperty("grade_name")
            String gradeName,

            @JsonProperty("email")
            String email,

            @JsonProperty("birth_date")
            LocalDate birthDate,

            @JsonProperty("gender")
            String gender,

            @JsonProperty("last_login_at")
            LocalDateTime lastLoginAt,

            @JsonProperty("joined_at")
            LocalDateTime joinedAt,

            @JsonProperty("granted_at")
            LocalDateTime grantedAt,

            @JsonProperty("password_changed_at")
            LocalDateTime passwordChangedAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record UserListResponseDto(
            List<UserListItemDto> items,
            int page,
            int size,

            @JsonProperty("total_count")
            long totalCount,

            @JsonProperty("total_pages")
            int totalPages,

            String message
    ) {
        public static UserListResponseDto success(
                List<UserListItemDto> items,
                int page,
                int size,
                long totalCount,
                int totalPages,
                String message
        ) {
            return new UserListResponseDto(items, page, size, totalCount, totalPages, message);
        }

        public static UserListResponseDto failure(String message) {
            return new UserListResponseDto(List.of(), 1, 20, 0, 0, message);
        }
    }
}
