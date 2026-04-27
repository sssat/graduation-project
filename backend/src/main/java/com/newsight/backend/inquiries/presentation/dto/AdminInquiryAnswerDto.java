// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/AdminInquiryAnswerDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public final class AdminInquiryAnswerDto {

    private AdminInquiryAnswerDto() {}

    /**
     * /api/admins/inquiries/{inquiry_seq}/answer/ (PUT)
     */
    public record AdminInquiryAnswerRequestDto(
            @JsonProperty("admin_message")
            @NotBlank
            String adminMessage,

            @NotBlank
            String status
    ) {
        public InquiriesService.AdminAnswerCommand toCommand() {
            return new InquiriesService.AdminAnswerCommand(adminMessage, status);
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryAnswerResponseDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            String status,
            @JsonProperty("processed_at")
            LocalDateTime processedAt,
            @JsonProperty("answer_updated_at")
            LocalDateTime answerUpdatedAt
    ) {
        public static AdminInquiryAnswerResponseDto from(InquiriesService.AdminAnswerResult result) {
            return new AdminInquiryAnswerResponseDto(
                    result.inquirySeq(),
                    result.status(),
                    result.processedAt(),
                    result.answerUpdatedAt()
            );
        }
    }
}
