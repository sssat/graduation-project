// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/MediaCompareTopKeywordsDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/media-compare/keywords/top
 */
public final class MediaCompareTopKeywordsDto {

    private MediaCompareTopKeywordsDto() {}

    public record MediaCompareTopKeywordsRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period,

            /**
             * 기본 10
             */
            Integer limit
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MediaCompareTopKeywordsResponseDto(
            @JsonProperty("period_start")
            String periodStart, // yyyy-MM-dd

            @JsonProperty("period_end")
            String periodEnd,   // yyyy-MM-dd

            @JsonProperty("selected_keyword")
            String selectedKeyword,

            @JsonProperty("selected_article_count")
            Integer selectedArticleCount,

            @JsonProperty("selected_media_count")
            Integer selectedMediaCount,

            @JsonProperty("items")
            List<KeywordPillItemDto> items,

            @JsonProperty("selected_keyword_seq")
            Long selectedKeywordSeq
    ) {}

    public record KeywordPillItemDto(
            @JsonProperty("keyword_seq")
            Long keywordSeq,

            String keyword
    ) {}
}