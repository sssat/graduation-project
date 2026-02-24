// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/InquiryDetailDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import java.time.LocalDateTime;

public final class InquiryDetailDto {

    private InquiryDetailDto() {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InquiryDetailResponseDto(
            InquiryDto inquiry
    ) {
        public static InquiryDetailResponseDto from(InquiriesService.InquiryDetailResult result) {
            return new InquiryDetailResponseDto(InquiryDto.from(result.inquiry()));
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InquiryDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            @JsonProperty("inquiry_type")
            String inquiryType,
            String title,
            String content,
            @JsonProperty("writer_user_id")
            String writerUserId,
            @JsonProperty("created_at")
            LocalDateTime createdAt,
            String status,
            @JsonProperty("is_private")
            boolean isPrivate
    ) {
        public static InquiryDto from(InquiriesService.InquiryDetail detail) {
            return new InquiryDto(
                    detail.inquirySeq(),
                    detail.inquiryType(),
                    detail.title(),
                    detail.content(),
                    detail.writerUserId(),
                    detail.createdAt(),
                    detail.status(),
                    detail.isPrivate()
            );
        }
    }
}