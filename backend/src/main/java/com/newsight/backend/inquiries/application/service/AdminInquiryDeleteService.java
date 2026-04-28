package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminInquiryDeleteService {

    private final InquirySupport support;
    private final SpringDataInquiryRepository inquiryRepository;

    public InquiriesService.AdminDeleteResult deleteInquiryForAdmin(Long actorUserSeq, Long inquirySeq) {
        User actor = support.getActorOrThrow(actorUserSeq);
        support.requireAdmin(actor);

        Inquiry inquiry = support.getInquiryOrThrow(inquirySeq);
        inquiryRepository.delete(inquiry);
        return new InquiriesService.AdminDeleteResult(inquirySeq);
    }
}
