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

            @JsonProperty("top_keywords")
            List<TopKeywordItemDto> topKeywords
    ) {}

    public record TopKeywordItemDto(
            @JsonProperty("rank_no")
            Integer rankNo,

            String keyword,

            @JsonProperty("article_count")
            Integer articleCount,

            @JsonProperty("is_analyzable")
            Boolean isAnalyzable
    ) {}
}