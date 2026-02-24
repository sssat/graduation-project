// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/AdminInquiryListDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminInquiryListDto {

    private AdminInquiryListDto() {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryListResponseDto(
            List<AdminInquiryListItemDto> items,
            int page,
            int size,
            @JsonProperty("total_count")
            long totalCount,
            @JsonProperty("total_pages")
            int totalPages
    ) {
        public static AdminInquiryListResponseDto from(InquiriesService.AdminInquiryListResult result) {
            List<AdminInquiryListItemDto> items = result.items().stream()
                    .map(AdminInquiryListItemDto::from)
                    .toList();

            return new AdminInquiryListResponseDto(
                    items,
                    result.page(),
                    result.size(),
                    result.totalCount(),
                    result.totalPages()
            );
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record AdminInquiryListItemDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            @JsonProperty("type_code")
            String typeCode,
            String title,
            @JsonProperty("inquirer_id")
            String inquirerId,
            @JsonProperty("submitted_at")
            LocalDateTime submittedAt,
            String status
    ) {
        public static AdminInquiryListItemDto from(InquiriesService.AdminInquiryListItem item) {
            return new AdminInquiryListItemDto(
                    item.inquirySeq(),
                    item.typeCode(),
                    item.title(),
                    item.inquirerId(),
                    item.submittedAt(),
                    item.status()
            );
        }
    }
}