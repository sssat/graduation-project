package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminInquiryAnswerService {

    private final InquirySupport support;
    private final SpringDataInquiryRepository inquiryRepository;
    private final Clock clock;

    public InquiriesService.AdminAnswerResult saveOrUpdateAdminAnswer(
            Long actorUserSeq,
            Long inquirySeq,
            InquiriesService.AdminAnswerCommand command
    ) {
        User actor = support.getActorOrThrow(actorUserSeq);
        support.requireAdmin(actor);

        Inquiry inquiry = support.getInquiryOrThrow(inquirySeq);

        String adminMessage = support.requireText(command.adminMessage(), "admin_message");
        String status = support.requireText(command.status(), "status").toUpperCase();

        if (!"DONE".equals(status)) {
            throw new IllegalArgumentException("status??DONE留??덉슜?⑸땲??");
        }

        LocalDateTime now = LocalDateTime.now(clock);

        boolean markDone = true;
        inquiry.writeOrUpdateAdminAnswer(adminMessage, markDone, actor, now);

        Inquiry saved = inquiryRepository.save(inquiry);

        return new InquiriesService.AdminAnswerResult(
                saved.getInquirySeq(),
                saved.isProcessed() ? "DONE" : "PROCESSING",
                saved.getProcessedAt(),
                saved.getAnswerUpdatedAt()
        );
    }
}
