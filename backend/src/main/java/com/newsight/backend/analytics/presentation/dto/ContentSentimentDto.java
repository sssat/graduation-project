// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/ContentSentimentDto.java
package com.newsight.backend.analytics.presentation.dto;

/**
 * GET /api/analytics/keywords/{keyword_seq}/sentiment/content/
 */
public final class ContentSentimentDto {

    private ContentSentimentDto() {}

    public record ContentSentimentRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record ContentSentimentResponseDto(
            Double positive,
            Double neutral,
            Double negative
    ) {}
}