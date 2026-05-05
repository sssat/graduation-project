// backend/src/main/java/com/newsight/backend/inquiries/presentation/dto/InquiryListDto.java
package com.newsight.backend.inquiries.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.newsight.backend.inquiries.application.service.InquiriesService;
import java.time.LocalDateTime;
import java.util.List;

public final class InquiryListDto {

    private InquiryListDto() {}

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InquiryListResponseDto(
            List<InquiryItemDto> items,
            int page,
            int size,
            @JsonProperty("total_count")
            long totalCount,
            @JsonProperty("total_pages")
            int totalPages
    ) {
        public static InquiryListResponseDto from(InquiriesService.InquiryListResult result) {
            List<InquiryItemDto> items = result.items().stream()
                    .map(InquiryItemDto::from)
                    .toList();

            return new InquiryListResponseDto(
                    items,
                    result.page(),
                    result.size(),
                    result.totalCount(),
                    result.totalPages()
            );
        }
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record InquiryItemDto(
            @JsonProperty("inquiry_seq")
            long inquirySeq,
            @JsonProperty("inquiry_type")
            String inquiryType,
            String title,
            @JsonProperty("writer_user_id")
            String writerUserId,
            @JsonProperty("created_at")
            LocalDateTime createdAt,
            String status,
            @JsonProperty("is_private")
            boolean isPrivate
    ) {
        public static InquiryItemDto from(InquiriesService.InquiryListItem item) {
            return new InquiryItemDto(
                    item.inquirySeq(),
                    item.inquiryType(),
                    item.title(),
                    item.writerUserId(),
                    item.createdAt(),
                    item.status(),
                    item.isPrivate()
            );
        }
    }
}