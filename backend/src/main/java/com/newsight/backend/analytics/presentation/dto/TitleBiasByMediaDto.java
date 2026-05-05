// backend/src/main/java/com/newsight/backend/analytics/presentation/dto/TitleBiasByMediaDto.java
package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * GET /api/analytics/keywords/{keyword_seq}/bias/title/
 */
public final class TitleBiasByMediaDto {

    private TitleBiasByMediaDto() {}

    public record TitleBiasByMediaRequestDto(
            /**
             * D7 | D14 (없으면 D7)
             */
            String period
    ) {}

    public record TitleBiasByMediaResponseDto(
            @JsonProperty("items")
            List<BiasByMediaItemDto> items
    ) {}

    public record BiasByMediaItemDto(
            @JsonProperty("media_name")
            String mediaName,

            @JsonProperty("bias_score")
            Double biasScore
    ) {}
}