// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/MediaArticleCountsDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/media-compare/keywords/{keyword_seq}/media-article-counts/
 */
public final class MediaArticleCountsDto {

    private MediaArticleCountsDto() {}

    public record MediaArticleCountsRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record MediaArticleCountsResponseDto(
            @JsonProperty("items")
            List<MediaArticleCountItemDto> items
    ) {}

    public record MediaArticleCountItemDto(
            @JsonProperty("media_name")
            String mediaName,

            @JsonProperty("article_count")
            Integer articleCount
    ) {}
}