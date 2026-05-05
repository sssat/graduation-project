package com.newsight.backend.visits.presentation.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public final class VisitTrackDto {

    private VisitTrackDto() {}

    public record VisitTrackRequestDto(
            @JsonProperty("client_visitor_id")
            String clientVisitorId,

            @JsonProperty("path")
            String path,

            @JsonProperty("referrer")
            String referrer,

            @JsonProperty("language")
            String language,

            @JsonProperty("client_time_zone")
            String clientTimeZone,

            @JsonProperty("screen_width")
            Integer screenWidth,

            @JsonProperty("screen_height")
            Integer screenHeight
    ) {}

    public record VisitTrackResponseDto(
            @JsonProperty("visit_date")
            String visitDate,

            @JsonProperty("tracked")
            boolean tracked
    ) {}
}
