// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/AnalyticsOverviewDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/overview/
 */
public final class AnalyticsOverviewDto {

    private AnalyticsOverviewDto() {}

    public record AnalyticsOverviewResponseDto(
            @JsonProperty("collected_article_count")
            Long collectedArticleCount,

            @JsonProperty("data_base_date")
            String dataBaseDate,

            @JsonProperty("data_started_at")
            String dataStartedAt,

            @JsonProperty("top_keywords")
            List<TopKeywordItemDto> topKeywords
    ) {}

    public record TopKeywordItemDto(
            @JsonProperty("rank_no")
            Integer rankNo,

            @JsonProperty("keyword_seq")
            Long keywordSeq,

            String keyword,

            @JsonProperty("article_count")
            Integer articleCount,

            @JsonProperty("is_analyzable")
            Boolean isAnalyzable
    ) {}
}
