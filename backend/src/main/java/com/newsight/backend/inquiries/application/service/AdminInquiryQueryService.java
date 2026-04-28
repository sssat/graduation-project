package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.domain.model.InquiryType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminInquiryQueryService {

    private final InquirySupport support;
    private final EntityManager em;

    public InquiriesService.AdminInquiryListResult listInquiriesForAdmin(
            Long actorUserSeq,
            Integer page,
            Integer size
    ) {
        User actor = support.getActorOrThrow(actorUserSeq);
        support.requireAdmin(actor);

        int p = support.normalizePage(page);
        int s = support.normalizeSize(size);
        int offset = (p - 1) * s;

        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<Inquiry> root = cq.from(Inquiry.class);
        Join<Inquiry, User> inquirerJoin = root.join("inquirer", JoinType.INNER);
        Join<Inquiry, InquiryType> typeJoin = root.join("type", JoinType.INNER);

        cq.select(cb.tuple(
                        root.get("inquirySeq").alias("inquirySeq"),
                        typeJoin.get("typeCode").alias("typeCode"),
                        root.get("title").alias("title"),
                        inquirerJoin.get("userId").alias("inquirerId"),
                        root.get("submittedAt").alias("submittedAt"),
                        root.get("isProcessed").alias("isProcessed")
                ))
                .orderBy(cb.desc(root.get("submittedAt")));

        List<Tuple> rows = em.createQuery(cq)
                .setFirstResult(offset)
                .setMaxResults(s)
                .getResultList();

        List<InquiriesService.AdminInquiryListItem> items = new ArrayList<>(rows.size());
        for (Tuple t : rows) {
            Long inquirySeq = t.get("inquirySeq", Long.class);
            String typeCode = t.get("typeCode", String.class);
            String titleVal = t.get("title", String.class);
            String inquirerId = t.get("inquirerId", String.class);
            LocalDateTime submittedAt = t.get("submittedAt", LocalDateTime.class);
            Boolean isProcessed = t.get("isProcessed", Boolean.class);

            items.add(new InquiriesService.AdminInquiryListItem(
                    inquirySeq,
                    typeCode,
                    titleVal,
                    inquirerId,
                    submittedAt,
                    (Boolean.TRUE.equals(isProcessed) ? "DONE" : "PROCESSING")
            ));
        }

        CriteriaQuery<Long> countCq = cb.createQuery(Long.class);
        Root<Inquiry> countRoot = countCq.from(Inquiry.class);
        countCq.select(cb.count(countRoot));

        long totalCount = em.createQuery(countCq).getSingleResult();
        int totalPages = (int) Math.max(1, (totalCount + s - 1) / s);

        return new InquiriesService.AdminInquiryListResult(items, p, s, totalCount, totalPages);
    }

    public InquiriesService.AdminInquiryDetailResult getInquiryDetailForAdmin(
            Long actorUserSeq,
            Long inquirySeq
    ) {
        User actor = support.getActorOrThrow(actorUserSeq);
        support.requireAdmin(actor);

        Inquiry inquiry = support.getInquiryOrThrow(inquirySeq);

        InquiriesService.AdminInquiryDetail detail = new InquiriesService.AdminInquiryDetail(
                inquiry.getInquirySeq(),
                inquiry.getType().getTypeCode(),
                inquiry.getTitle(),
                inquiry.getMessage(),
                inquiry.getInquirer().getUserId(),
                inquiry.getSubmittedAt(),
                inquiry.isProcessed() ? "DONE" : "PROCESSING",
                inquiry.getAdminMessage()
        );

        return new InquiriesService.AdminInquiryDetailResult(detail);
    }
}
