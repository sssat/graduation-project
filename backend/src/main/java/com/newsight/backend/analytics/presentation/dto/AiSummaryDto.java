// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/AiSummaryDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * GET /api/analytics/keywords/{keyword_seq}/summary/
 */
public final class AiSummaryDto {

    private AiSummaryDto() {}

    public record AiSummaryRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             * - 명세에 존재하므로 파라미터로 받을 수 있게 둠
             */
            String period
    ) {}

    public record AiSummaryResponseDto(
            @JsonProperty("summary_text")
            String summaryText
    ) {}
}