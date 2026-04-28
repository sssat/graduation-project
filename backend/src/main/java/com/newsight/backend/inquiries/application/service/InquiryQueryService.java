package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.domain.model.InquiryType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InquiryQueryService {

    private final InquirySupport support;
    private final EntityManager em;

    public InquiriesService.InquiryListResult listInquiries(
            Long actorUserSeq,
            InquiriesService.InquiryListQuery query
    ) {
        User actor = support.getActorOrThrow(actorUserSeq);
        boolean admin = support.isAdmin(actor);

        int page = support.normalizePage(query.page());
        int size = support.normalizeSize(query.size());
        int offset = (page - 1) * size;

        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<Tuple> cq = cb.createTupleQuery();
        Root<Inquiry> root = cq.from(Inquiry.class);
        Join<Inquiry, User> inquirerJoin = root.join("inquirer", JoinType.INNER);
        Join<Inquiry, InquiryType> typeJoin = root.join("type", JoinType.INNER);

        List<Predicate> predicates = buildUserListPredicates(
                cb, root, inquirerJoin, typeJoin,
                actorUserSeq, admin,
                query.inquiryType(), query.status(), query.mine()
        );

        cq.select(cb.tuple(
                        root.get("inquirySeq").alias("inquirySeq"),
                        typeJoin.get("typeCode").alias("inquiryType"),
                        root.get("title").alias("title"),
                        inquirerJoin.get("userId").alias("writerUserId"),
                        root.get("submittedAt").alias("createdAt"),
                        root.get("isProcessed").alias("isProcessed"),
                        root.get("isPrivate").alias("isPrivate")
                ))
                .where(predicates.toArray(Predicate[]::new))
                .orderBy(cb.desc(root.get("submittedAt")));

        TypedQuery<Tuple> typed = em.createQuery(cq)
                .setFirstResult(offset)
                .setMaxResults(size);

        List<Tuple> rows = typed.getResultList();
        List<InquiriesService.InquiryListItem> items = new ArrayList<>(rows.size());
        for (Tuple t : rows) {
            Long inquirySeq = t.get("inquirySeq", Long.class);
            String inquiryType = t.get("inquiryType", String.class);
            String title = t.get("title", String.class);
            String writerUserId = t.get("writerUserId", String.class);
            LocalDateTime createdAt = t.get("createdAt", LocalDateTime.class);
            Boolean isProcessed = t.get("isProcessed", Boolean.class);
            Boolean isPrivate = t.get("isPrivate", Boolean.class);

            items.add(new InquiriesService.InquiryListItem(
                    inquirySeq,
                    inquiryType,
                    title,
                    writerUserId,
                    createdAt,
                    (Boolean.TRUE.equals(isProcessed) ? "DONE" : "PROCESSING"),
                    Boolean.TRUE.equals(isPrivate)
            ));
        }

        CriteriaQuery<Long> countCq = cb.createQuery(Long.class);
        Root<Inquiry> countRoot = countCq.from(Inquiry.class);
        Join<Inquiry, User> countInquirerJoin = countRoot.join("inquirer", JoinType.INNER);
        Join<Inquiry, InquiryType> countTypeJoin = countRoot.join("type", JoinType.INNER);

        List<Predicate> countPredicates = buildUserListPredicates(
                cb, countRoot, countInquirerJoin, countTypeJoin,
                actorUserSeq, admin,
                query.inquiryType(), query.status(), query.mine()
        );

        countCq.select(cb.count(countRoot))
                .where(countPredicates.toArray(Predicate[]::new));

        long totalCount = em.createQuery(countCq).getSingleResult();
        int totalPages = (int) Math.max(1, (totalCount + size - 1) / size);

        return new InquiriesService.InquiryListResult(items, page, size, totalCount, totalPages);
    }

    public InquiriesService.InquiryDetailResult getInquiryDetail(Long actorUserSeq, Long inquirySeq) {
        User actor = support.getActorOrThrow(actorUserSeq);
        Inquiry inquiry = support.getInquiryOrThrow(inquirySeq);

        boolean admin = support.isAdmin(actor);
        boolean isOwner = Objects.equals(inquiry.getInquirer().getUserSeq(), actorUserSeq);

        if (inquiry.isPrivate() && !admin && !isOwner) {
            throw new AccessDeniedException("鍮꾧났媛?臾몄쓽湲? ?묒꽦???먮뒗 愿由ъ옄留??대엺?????덉뒿?덈떎.");
        }

        String answeredBy = null;
        if (inquiry.getProcessedBy() != null) {
            answeredBy = inquiry.getProcessedBy().getUserId();
        }

        InquiriesService.InquiryDetail detail = new InquiriesService.InquiryDetail(
                inquiry.getInquirySeq(),
                inquiry.getType().getTypeCode(),
                inquiry.getTitle(),
                inquiry.getMessage(),
                inquiry.getInquirer().getUserId(),
                inquiry.getSubmittedAt(),
                inquiry.isProcessed() ? "DONE" : "PROCESSING",
                inquiry.isPrivate(),
                inquiry.getAdminMessage(),
                inquiry.getProcessedAt(),
                inquiry.getAnswerUpdatedAt(),
                answeredBy,
                "?댁쁺?"
        );

        return new InquiriesService.InquiryDetailResult(detail);
    }

    private List<Predicate> buildUserListPredicates(
            CriteriaBuilder cb,
            Root<Inquiry> root,
            Join<Inquiry, User> inquirerJoin,
            Join<Inquiry, InquiryType> typeJoin,
            Long actorUserSeq,
            boolean admin,
            String inquiryType,
            String status,
            Boolean mine
    ) {
        List<Predicate> predicates = new ArrayList<>();

        if (inquiryType != null && !inquiryType.isBlank()) {
            predicates.add(cb.equal(typeJoin.get("typeCode"), inquiryType.trim()));
        }

        Boolean isProcessed = support.parseStatusToIsProcessed(status);
        if (isProcessed != null) {
            predicates.add(cb.equal(root.get("isProcessed"), isProcessed));
        }

        boolean mineOnly = Boolean.TRUE.equals(mine);

        if (admin) {
            if (mineOnly) {
                predicates.add(cb.equal(inquirerJoin.get("userSeq"), actorUserSeq));
            }
            return predicates;
        }

        if (mineOnly) {
            predicates.add(cb.equal(inquirerJoin.get("userSeq"), actorUserSeq));
        } else {
            predicates.add(cb.or(
                    cb.isFalse(root.get("isPrivate")),
                    cb.equal(inquirerJoin.get("userSeq"), actorUserSeq)
            ));
        }

        return predicates;
    }
}
