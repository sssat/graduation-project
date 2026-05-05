package com.newsight.backend.analytics.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public final class SearchTimelineDto {

    private SearchTimelineDto() {}

    public record SearchTimelineResponseDto(
            @JsonProperty("period_start")
            String periodStart,

            @JsonProperty("period_end")
            String periodEnd,

            @JsonProperty("latest_score")
            Integer latestScore,

            @JsonProperty("peak_score")
            Integer peakScore,

            @JsonProperty("average_score")
            Double averageScore,

            @JsonProperty("has_partial")
            Boolean hasPartial,

            List<TimelinePointDto> items
    ) {}

    public record TimelinePointDto(
            @JsonProperty("observed_date")
            String observedDate,

            @JsonProperty("interest_score")
            Integer interestScore,

            @JsonProperty("is_partial")
            Boolean isPartial
    ) {}
}
