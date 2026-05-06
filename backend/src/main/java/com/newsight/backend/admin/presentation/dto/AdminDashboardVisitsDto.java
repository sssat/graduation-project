package com.newsight.backend.admin.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminDashboardVisitsDto {

    private AdminDashboardVisitsDto() {}

    public record AdminDashboardVisitsRequestDto(
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
    public record AdminDashboardVisitsResponseDto(
            List<VisitItemDto> items,
            int page,
            int size,

            @JsonProperty("total_count")
            long totalCount,

            @JsonProperty("total_pages")
            int totalPages
    ) {}

    public record VisitItemDto(
            @JsonProperty("visitor_daily_seq")
            Long visitorDailySeq,

            @JsonProperty("first_visited_at")
            LocalDateTime firstVisitedAt,

            @JsonProperty("last_visited_at")
            LocalDateTime lastVisitedAt,

            @JsonProperty("page_view_count")
            int pageViewCount,

            @JsonProperty("ip_address")
            String ipAddress,

            @JsonProperty("user_agent")
            String userAgent,

            @JsonProperty("referrer")
            String referrer,

            @JsonProperty("accept_language")
            String acceptLanguage,

            @JsonProperty("client_time_zone")
            String clientTimeZone,

            @JsonProperty("screen_width")
            Integer screenWidth,

            @JsonProperty("screen_height")
            Integer screenHeight,

            @JsonProperty("first_path")
            String firstPath,

            @JsonProperty("last_path")
            String lastPath
    ) {}
}
