package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.domain.model.InquiryType;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryRepository;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryTypeRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class InquiryCommandService {

    private final InquirySupport support;
    private final SpringDataInquiryRepository inquiryRepository;
    private final SpringDataInquiryTypeRepository inquiryTypeRepository;
    private final Clock clock;

    public InquiriesService.CreateInquiryResult createInquiry(
            Long actorUserSeq,
            InquiriesService.InquiryCreateCommand command
    ) {
        User actor = support.getActorOrThrow(actorUserSeq);

        String typeCode = support.requireText(command.inquiryType(), "inquiry_type");
        String title = support.requireText(command.title(), "title");
        String message = support.requireText(command.message(), "message");
        boolean isPrivate = Boolean.TRUE.equals(command.isPrivate());

        if (title.length() > 200) {
            throw new IllegalArgumentException("title? 理쒕? 200?먭퉴吏 媛?ν빀?덈떎.");
        }

        InquiryType type = inquiryTypeRepository.findById(typeCode)
                .orElseThrow(() -> new IllegalArgumentException("?좏슚?섏? ?딆? inquiry_type ?낅땲?? inquiry_type=" + typeCode));

        LocalDateTime now = LocalDateTime.now(clock);

        Inquiry inquiry = Inquiry.builder()
                .inquirer(actor)
                .processedBy(null)
                .type(type)
                .title(title)
                .message(message)
                .submittedAt(now)
                .isProcessed(false)
                .isPrivate(isPrivate)
                .processedAt(null)
                .adminMessage(null)
                .answerUpdatedAt(null)
                .build();

        Inquiry saved = inquiryRepository.save(inquiry);
        return new InquiriesService.CreateInquiryResult(saved.getInquirySeq(), saved.getSubmittedAt());
    }
}
