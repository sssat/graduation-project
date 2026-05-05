// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/WordcloudDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET
 * - /api/analytics/keywords/{keyword_seq}/wordcloud/title/
 * - /api/analytics/keywords/{keyword_seq}/wordcloud/comment/
 */
public final class WordcloudDto {

    private WordcloudDto() {}

    public record WordcloudRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record WordcloudResponseDto(
            @JsonProperty("items")
            List<WordItemDto> items
    ) {}

    public record WordItemDto(
            String word,
            Double weight
    ) {}
}