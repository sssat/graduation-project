// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/InquiryCreateDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public final class InquiryCreateDto {

    private InquiryCreateDto() {}

    /**
     * /api/inquiries/ (POST)
     */
    public record InquiryCreateRequestDto(
            @JsonProperty("inquiry_type")
            @NotBlank
            String inquiryType,

            @NotBlank
            @Size(max = 200)
            String title,

            @NotBlank
            String message,

            @JsonProperty("is_private")
            Boolean isPrivate
    ) {
        public InquiriesService.InquiryCreateCommand toCommand() {
            return new InquiriesService.InquiryCreateCommand(
                    inquiryType,
                    title,
                    message,
                    isPrivate
            );
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InquiryCreateResponseDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            @JsonProperty("submitted_at")
            LocalDateTime submittedAt
    ) {
        public static InquiryCreateResponseDto from(InquiriesService.CreateInquiryResult result) {
            return new InquiryCreateResponseDto(result.inquirySeq(), result.submittedAt());
        }
    }
}
