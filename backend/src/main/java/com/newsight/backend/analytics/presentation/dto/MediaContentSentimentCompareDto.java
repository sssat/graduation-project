// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/MediaContentSentimentCompareDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/media-compare/keywords/{keyword_seq}/sentiment/content/
 */
public final class MediaContentSentimentCompareDto {

    private MediaContentSentimentCompareDto() {}

    public record MediaContentSentimentCompareRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record MediaContentSentimentCompareResponseDto(
            @JsonProperty("items")
            List<MediaSentimentItemDto> items
    ) {}

    public record MediaSentimentItemDto(
            @JsonProperty("media_name")
            String mediaName,

            Double positive,
            Double neutral,
            Double negative
    ) {}
}