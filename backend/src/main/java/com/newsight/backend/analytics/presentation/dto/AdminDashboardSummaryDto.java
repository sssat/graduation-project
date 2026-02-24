// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/AdminDashboardSummaryDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 관리자 대시보드 - 요약 조회 DTO
 * GET /api/admins/dashboard/summary
 */
public final class AdminDashboardSummaryDto {

    private AdminDashboardSummaryDto() {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AdminDashboardSummaryResponseDto(
            @JsonProperty("today_joined_count")
            long todayJoinedCount,

            @JsonProperty("today_joined_delta_rate")
            Double todayJoinedDeltaRate,

            @JsonProperty("today_collected_article_count")
            long todayCollectedArticleCount,

            @JsonProperty("today_collected_article_delta_rate")
            Double todayCollectedArticleDeltaRate,

            @JsonProperty("processing_inquiry_count")
            long processingInquiryCount,

            @JsonProperty("processing_inquiry_avg_elapsed_days")
            Double processingInquiryAvgElapsedDays
    ) {}
}