package com.newsight.backend.inquiries.application.service;

import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class InquiriesService {

    private final InquiryQueryService inquiryQueryService;
    private final InquiryCommandService inquiryCommandService;
    private final AdminInquiryQueryService adminInquiryQueryService;
    private final AdminInquiryAnswerService adminInquiryAnswerService;
    private final AdminInquiryDeleteService adminInquiryDeleteService;

    public InquiryListResult listInquiries(Long actorUserSeq, InquiryListQuery query) {
        return inquiryQueryService.listInquiries(actorUserSeq, query);
    }

    public InquiryDetailResult getInquiryDetail(Long actorUserSeq, Long inquirySeq) {
        return inquiryQueryService.getInquiryDetail(actorUserSeq, inquirySeq);
    }

    public CreateInquiryResult createInquiry(Long actorUserSeq, InquiryCreateCommand command) {
        return inquiryCommandService.createInquiry(actorUserSeq, command);
    }

    public AdminInquiryListResult listInquiriesForAdmin(Long actorUserSeq, Integer page, Integer size) {
        return adminInquiryQueryService.listInquiriesForAdmin(actorUserSeq, page, size);
    }

    public AdminInquiryDetailResult getInquiryDetailForAdmin(Long actorUserSeq, Long inquirySeq) {
        return adminInquiryQueryService.getInquiryDetailForAdmin(actorUserSeq, inquirySeq);
    }

    public AdminAnswerResult saveOrUpdateAdminAnswer(Long actorUserSeq, Long inquirySeq, AdminAnswerCommand command) {
        return adminInquiryAnswerService.saveOrUpdateAdminAnswer(actorUserSeq, inquirySeq, command);
    }

    public AdminDeleteResult deleteInquiryForAdmin(Long actorUserSeq, Long inquirySeq) {
        return adminInquiryDeleteService.deleteInquiryForAdmin(actorUserSeq, inquirySeq);
    }

    public record InquiryListQuery(
            String inquiryType,
            String status,
            Boolean mine,
            Integer page,
            Integer size
    ) {}

    public record InquiryCreateCommand(
            String inquiryType,
            String title,
            String message,
            Boolean isPrivate
    ) {}

    public record AdminAnswerCommand(
            String adminMessage,
            String status
    ) {}

    public record InquiryListItem(
            Long inquirySeq,
            String inquiryType,
            String title,
            String writerUserId,
            LocalDateTime createdAt,
            String status,
            boolean isPrivate
    ) {}

    public record InquiryListResult(
            List<InquiryListItem> items,
            int page,
            int size,
            long totalCount,
            int totalPages
    ) {}

    public record InquiryDetail(
            Long inquirySeq,
            String inquiryType,
            String title,
            String content,
            String writerUserId,
            LocalDateTime createdAt,
            String status,
            boolean isPrivate,
            String adminMessage,
            LocalDateTime processedAt,
            LocalDateTime answerUpdatedAt,
            String answeredBy,
            String answerTeamLabel
    ) {}

    public record InquiryDetailResult(InquiryDetail inquiry) {}

    public record AdminInquiryListItem(
            Long inquirySeq,
            String typeCode,
            String title,
            String inquirerId,
            LocalDateTime submittedAt,
            String status
    ) {}

    public record AdminInquiryListResult(
            List<AdminInquiryListItem> items,
            int page,
            int size,
            long totalCount,
            int totalPages
    ) {}

    public record AdminInquiryDetail(
            Long inquirySeq,
            String typeCode,
            String title,
            String message,
            String inquirerId,
            LocalDateTime submittedAt,
            String status,
            String adminMessage
    ) {}

    public record AdminInquiryDetailResult(AdminInquiryDetail inquiry) {}

    public record CreateInquiryResult(
            Long inquirySeq,
            LocalDateTime submittedAt
    ) {}

    public record AdminAnswerResult(
            Long inquirySeq,
            String status,
            LocalDateTime processedAt,
            LocalDateTime answerUpdatedAt
    ) {}

    public record AdminDeleteResult(Long inquirySeq) {}
}
