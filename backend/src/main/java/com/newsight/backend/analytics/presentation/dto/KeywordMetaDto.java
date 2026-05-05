// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/KeywordMetaDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * GET /api/analytics/keywords/{keyword_seq}/
 */
public final class KeywordMetaDto {

    private KeywordMetaDto() {}

    public record KeywordMetaRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record KeywordMetaResponseDto(
            @JsonProperty("keyword_seq")
            Long keywordSeq,

            String keyword,

            @JsonProperty("period_start")
            String periodStart, // yyyy-MM-dd

            @JsonProperty("period_end")
            String periodEnd,   // yyyy-MM-dd

            @JsonProperty("article_count")
            Integer articleCount,

            @JsonProperty("media_count")
            Integer mediaCount,

            @JsonProperty("is_analyzable")
            Boolean isAnalyzable
    ) {}
}