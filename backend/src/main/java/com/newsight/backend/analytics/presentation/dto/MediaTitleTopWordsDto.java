// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/MediaTitleTopWordsDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words/
 */
public final class MediaTitleTopWordsDto {

    private MediaTitleTopWordsDto() {}

    public record MediaTitleTopWordsRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period,

            /**
             * 기본 5
             */
            @JsonProperty("top_n")
            Integer topN
    ) {}

    public record MediaTitleTopWordsResponseDto(
            @JsonProperty("items")
            List<MediaTopWordsItemDto> items
    ) {}

    public record MediaTopWordsItemDto(
            @JsonProperty("media_name")
            String mediaName,

            List<String> words
    ) {}
}