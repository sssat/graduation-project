// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/AdminInquiryDeleteDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;

public final class AdminInquiryDeleteDto {

    private AdminInquiryDeleteDto() {}

    /**
     * /api/admins/inquiries/{inquiry_seq}/ (DELETE)
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryDeleteResponseDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq
    ) {
        public static AdminInquiryDeleteResponseDto from(InquiriesService.AdminDeleteResult result) {
            return new AdminInquiryDeleteResponseDto(result.inquirySeq());
        }
    }
}