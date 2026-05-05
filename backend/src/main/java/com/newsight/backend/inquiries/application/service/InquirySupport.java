package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.UserLevel;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.common.exception.NotFoundException;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InquirySupport {

    private static final short GRADE_ADMIN = 1;
    private static final short GRADE_SUPER_ADMIN = 2;

    private final SpringDataUserRepository userRepository;
    private final SpringDataInquiryRepository inquiryRepository;

    User getActorOrThrow(Long actorUserSeq) {
        if (actorUserSeq == null) {
            throw new AccessDeniedException("?몄쬆 ?뺣낫媛 ?놁뒿?덈떎.");
        }
        return userRepository.findById(actorUserSeq)
                .orElseThrow(() -> new AccessDeniedException("?몄쬆 ?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎. user_seq=" + actorUserSeq));
    }

    Inquiry getInquiryOrThrow(Long inquirySeq) {
        return inquiryRepository.findById(inquirySeq)
                .orElseThrow(() -> new NotFoundException("臾몄쓽湲??李얠쓣 ???놁뒿?덈떎. inquiry_seq=" + inquirySeq));
    }

    boolean isAdmin(User user) {
        UserLevel level = user.getUserLevel();
        if (level == null || level.getGradeCode() == null) {
            return false;
        }
        short code = level.getGradeCode();
        return code == GRADE_ADMIN || code == GRADE_SUPER_ADMIN;
    }

    void requireAdmin(User user) {
        if (!isAdmin(user)) {
            throw new AccessDeniedException("愿由ъ옄 沅뚰븳???꾩슂?⑸땲??");
        }
    }

    int normalizePage(Integer page) {
        int p = (page == null ? 1 : page);
        return Math.max(1, p);
    }

    int normalizeSize(Integer size) {
        int s = (size == null ? 10 : size);
        if (s < 1) {
            return 10;
        }
        return Math.min(s, 100);
    }

    String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + "?(?? ?꾩닔?낅땲??");
        }
        return value.trim();
    }

    Boolean parseStatusToIsProcessed(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String s = status.trim().toUpperCase();
        return switch (s) {
            case "PROCESSING" -> Boolean.FALSE;
            case "DONE" -> Boolean.TRUE;
            default -> throw new IllegalArgumentException("status??PROCESSING ?먮뒗 DONE留??덉슜?⑸땲??");
        };
    }
}
