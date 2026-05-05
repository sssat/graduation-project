// backend/src/main/java/com/newsight/backend/accounts/presentation/dto/AdminDashboardLoginLogsDto.java
package com.newsight.backend.accounts.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 관리자 대시보드 - 로그인 로그 조회 DTO
 * GET /api/admins/dashboard/login-logs?page=&size=
 */
public final class AdminDashboardLoginLogsDto {

    private AdminDashboardLoginLogsDto() {}

    public record AdminDashboardLoginLogsRequestDto(
            Integer page,
            Integer size
    ) {
        public int pageOrDefault() {
            return (page == null || page < 1) ? 1 : page;
        }

        public int sizeOrDefault() {
            int s = (size == null || size < 1) ? 10 : size;
            return Math.min(s, 100);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AdminDashboardLoginLogsResponseDto(
            List<LoginLogItemDto> items,
            int page,
            int size,

            @JsonProperty("total_count")
            long totalCount,

            @JsonProperty("total_pages")
            int totalPages
    ) {}

    public record LoginLogItemDto(
            @JsonProperty("login_log_seq")
            Long loginLogSeq,

            @JsonProperty("input_id")
            String inputId,

            @JsonProperty("attempted_at")
            LocalDateTime attemptedAt,

            @JsonProperty("user_seq")
            Long userSeq,

            @JsonProperty("is_success")
            boolean isSuccess,

            @JsonProperty("ip_address")
            String ipAddress,

            @JsonProperty("user_agent")
            String userAgent
    ) {}
}