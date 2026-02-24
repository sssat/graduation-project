// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/AdminInquiryDetailDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import java.time.LocalDateTime;

public final class AdminInquiryDetailDto {

    private AdminInquiryDetailDto() {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryDetailResponseDto(
            AdminInquiryDto inquiry
    ) {
        public static AdminInquiryDetailResponseDto from(InquiriesService.AdminInquiryDetailResult result) {
            return new AdminInquiryDetailResponseDto(AdminInquiryDto.from(result.inquiry()));
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            @JsonProperty("type_code")
            String typeCode,
            String title,
            String message,
            @JsonProperty("inquirer_id")
            String inquirerId,
            @JsonProperty("submitted_at")
            LocalDateTime submittedAt,
            String status,
            @JsonProperty("admin_message")
            String adminMessage
    ) {
        public static AdminInquiryDto from(InquiriesService.AdminInquiryDetail detail) {
            return new AdminInquiryDto(
                    detail.inquirySeq(),
                    detail.typeCode(),
                    detail.title(),
                    detail.message(),
                    detail.inquirerId(),
                    detail.submittedAt(),
                    detail.status(),
                    detail.adminMessage()
            );
        }
    }
}