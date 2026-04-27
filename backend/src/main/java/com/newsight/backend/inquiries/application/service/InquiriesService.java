// backend/src/main/java/com/newsight/backend/inquiries/application/service/InquiriesService.java
package com.newsight.backend.inquiries.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.UserLevel;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.common.exception.NotFoundException;
import com.newsight.backend.inquiries.domain.model.Inquiry;
import com.newsight.backend.inquiries.domain.model.InquiryType;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryRepository;
import com.newsight.backend.inquiries.infrastructure.persistence.SpringDataInquiryTypeRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inquiries 비즈니스 로직 (레이어드 아키텍처 버전)
 *
 * API 명세 반영:
 * - /api/inquiries/ (GET/POST): JWT(USER 이상)
 *   - USER는 공개글 + 본인 비공개 글만 반환(다른 사람 비공개글은 제외)
 *   - ADMIN 이상은 전체 조회 가능
 * - /api/inquiries/{inquiry_seq}/ (GET): 비공개면 작성자 또는 ADMIN 이상만 열람
 * - /api/admins/inquiries/... : JWT(ADMIN 이상)
 */
@Service
@RequiredArgsConstructor
@Transactional
public class InquiriesService {

    private static final short GRADE_ADMIN = 1;
    private static final short GRADE_SUPER_ADMIN = 2;

    private final SpringDataInquiryRepository inquiryRepository;
    private final SpringDataInquiryTypeRepository inquiryTypeRepository;
    private final SpringDataUserRepository userRepository;

    private final EntityManager em;
    private final Clock clock;

    /* =========================
     * Command / Query (임시 record)
     *  - 추후 InquiriesUseCase로 분리해도 됨
     * ========================= */

    public record InquiryListQuery(
            String inquiryType,     // optional
            String status,          // optional: PROCESSING | DONE
            Boolean mine,           // optional
            Integer page,           // optional, default=1
            Integer size            // optional, default=10
    ) {}

    public record InquiryCreateCommand(
            String inquiryType,     // required (TYPE_CODE)
            String title,           // required
            String message,         // required
            Boolean isPrivate       // optional, default=false
    ) {}

    public record AdminAnswerCommand(
            String adminMessage,    // required
            String status           // required: DONE (PROCESSING으로 되돌리기 금지)
    ) {}

    /* =========================
     * Response records (임시)
     * ========================= */

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

    /* =========================
     * Public APIs
     * ========================= */

    /**
     * /api/inquiries/ GET
     */
    @Transactional(readOnly = true)
    public InquiryListResult listInquiries(Long actorUserSeq, InquiryListQuery query) {
        User actor = getActorOrThrow(actorUserSeq);
        boolean admin = isAdmin(actor);

        int page = normalizePage(query.page());
        int size = normalizeSize(query.size());
        int offset = (page - 1) * size;

        CriteriaBuilder cb = em.getCriteriaBuilder();

        // 목록 조회 (필드 프로젝션)
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
        List<InquiryListItem> items = new ArrayList<>(rows.size());
        for (Tuple t : rows) {
            Long inquirySeq = t.get("inquirySeq", Long.class);
            String inquiryType = t.get("inquiryType", String.class);
            String title = t.get("title", String.class);
            String writerUserId = t.get("writerUserId", String.class);
            LocalDateTime createdAt = t.get("createdAt", LocalDateTime.class);
            Boolean isProcessed = t.get("isProcessed", Boolean.class);
            Boolean isPrivate = t.get("isPrivate", Boolean.class);

            items.add(new InquiryListItem(
                    inquirySeq,
                    inquiryType,
                    title,
                    writerUserId,
                    createdAt,
                    (Boolean.TRUE.equals(isProcessed) ? "DONE" : "PROCESSING"),
                    Boolean.TRUE.equals(isPrivate)
            ));
        }

        // count 쿼리
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

        return new InquiryListResult(items, page, size, totalCount, totalPages);
    }

    /**
     * /api/inquiries/{inquiry_seq}/ GET
     */
    @Transactional(readOnly = true)
    public InquiryDetailResult getInquiryDetail(Long actorUserSeq, Long inquirySeq) {
        User actor = getActorOrThrow(actorUserSeq);
        Inquiry inquiry = inquiryRepository.findById(inquirySeq)
                .orElseThrow(() -> new NotFoundException("문의글을 찾을 수 없습니다. inquiry_seq=" + inquirySeq));

        boolean admin = isAdmin(actor);
        boolean isOwner = Objects.equals(inquiry.getInquirer().getUserSeq(), actorUserSeq);

        // 비공개면 작성자 또는 ADMIN만 열람
        if (inquiry.isPrivate() && !admin && !isOwner) {
            throw new AccessDeniedException("비공개 문의글은 작성자 또는 관리자만 열람할 수 있습니다.");
        }

        String answeredBy = null;
        if (inquiry.getProcessedBy() != null) {
            answeredBy = inquiry.getProcessedBy().getUserId();
        }

        InquiryDetail detail = new InquiryDetail(
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
                "운영팀"
        );

        return new InquiryDetailResult(detail);
    }

    /**
     * /api/inquiries/ POST
     */
    public CreateInquiryResult createInquiry(Long actorUserSeq, InquiryCreateCommand command) {
        User actor = getActorOrThrow(actorUserSeq);

        String typeCode = requireText(command.inquiryType(), "inquiry_type");
        String title = requireText(command.title(), "title");
        String message = requireText(command.message(), "message");
        boolean isPrivate = Boolean.TRUE.equals(command.isPrivate());

        if (title.length() > 200) {
            throw new IllegalArgumentException("title은 최대 200자까지 가능합니다.");
        }

        InquiryType type = inquiryTypeRepository.findById(typeCode)
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 inquiry_type 입니다. inquiry_type=" + typeCode));

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
        return new CreateInquiryResult(saved.getInquirySeq(), saved.getSubmittedAt());
    }

    /**
     * /api/admins/inquiries/ GET
     * - 현재 명세서는 page/size만 있지만, 나중에 필터가 늘어날 수 있으니 Result는 유지
     */
    @Transactional(readOnly = true)
    public AdminInquiryListResult listInquiriesForAdmin(Long actorUserSeq, Integer page, Integer size) {
        User actor = getActorOrThrow(actorUserSeq);
        requireAdmin(actor);

        int p = normalizePage(page);
        int s = normalizeSize(size);
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

        List<AdminInquiryListItem> items = new ArrayList<>(rows.size());
        for (Tuple t : rows) {
            Long inquirySeq = t.get("inquirySeq", Long.class);
            String typeCode = t.get("typeCode", String.class);
            String titleVal = t.get("title", String.class);
            String inquirerId = t.get("inquirerId", String.class);
            LocalDateTime submittedAt = t.get("submittedAt", LocalDateTime.class);
            Boolean isProcessed = t.get("isProcessed", Boolean.class);

            items.add(new AdminInquiryListItem(
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

        return new AdminInquiryListResult(items, p, s, totalCount, totalPages);
    }

    /**
     * /api/admins/inquiries/{inquiry_seq}/ GET
     */
    @Transactional(readOnly = true)
    public AdminInquiryDetailResult getInquiryDetailForAdmin(Long actorUserSeq, Long inquirySeq) {
        User actor = getActorOrThrow(actorUserSeq);
        requireAdmin(actor);

        Inquiry inquiry = inquiryRepository.findById(inquirySeq)
                .orElseThrow(() -> new NotFoundException("문의글을 찾을 수 없습니다. inquiry_seq=" + inquirySeq));

        AdminInquiryDetail detail = new AdminInquiryDetail(
                inquiry.getInquirySeq(),
                inquiry.getType().getTypeCode(),
                inquiry.getTitle(),
                inquiry.getMessage(),
                inquiry.getInquirer().getUserId(),
                inquiry.getSubmittedAt(),
                inquiry.isProcessed() ? "DONE" : "PROCESSING",
                inquiry.getAdminMessage()
        );

        return new AdminInquiryDetailResult(detail);
    }

    /**
     * /api/admins/inquiries/{inquiry_seq}/answer/ PUT
     * - 처리 중(PROCESSING)은 DONE 전환 가능
     * - DONE은 답변 수정 가능(ANSWER_UPDATED_AT 갱신)
     * - DONE -> PROCESSING 되돌리기 금지
     */
    public AdminAnswerResult saveOrUpdateAdminAnswer(Long actorUserSeq, Long inquirySeq, AdminAnswerCommand command) {
        User actor = getActorOrThrow(actorUserSeq);
        requireAdmin(actor);

        Inquiry inquiry = inquiryRepository.findById(inquirySeq)
                .orElseThrow(() -> new NotFoundException("문의글을 찾을 수 없습니다. inquiry_seq=" + inquirySeq));

        String adminMessage = requireText(command.adminMessage(), "admin_message");
        String status = requireText(command.status(), "status").toUpperCase();

        if (!"DONE".equals(status)) {
            throw new IllegalArgumentException("status는 DONE만 허용됩니다.");
        }

        LocalDateTime now = LocalDateTime.now(clock);

        // 엔티티 메서드 활용(처리완료/수정 규칙 반영)
        boolean markDone = true;
        inquiry.writeOrUpdateAdminAnswer(adminMessage, markDone, actor, now);

        Inquiry saved = inquiryRepository.save(inquiry);

        return new AdminAnswerResult(
                saved.getInquirySeq(),
                saved.isProcessed() ? "DONE" : "PROCESSING",
                saved.getProcessedAt(),
                saved.getAnswerUpdatedAt()
        );
    }

    /**
     * /api/admins/inquiries/{inquiry_seq}/ DELETE
     */
    public AdminDeleteResult deleteInquiryForAdmin(Long actorUserSeq, Long inquirySeq) {
        User actor = getActorOrThrow(actorUserSeq);
        requireAdmin(actor);

        Inquiry inquiry = inquiryRepository.findById(inquirySeq)
                .orElseThrow(() -> new NotFoundException("문의글을 찾을 수 없습니다. inquiry_seq=" + inquirySeq));

        inquiryRepository.delete(inquiry);
        return new AdminDeleteResult(inquirySeq);
    }

    /* =========================
     * Helpers
     * ========================= */

    private User getActorOrThrow(Long actorUserSeq) {
        if (actorUserSeq == null) {
            throw new AccessDeniedException("인증 정보가 없습니다.");
        }
        return userRepository.findById(actorUserSeq)
                .orElseThrow(() -> new AccessDeniedException("인증 사용자 정보를 찾을 수 없습니다. user_seq=" + actorUserSeq));
    }

    private boolean isAdmin(User user) {
        UserLevel level = user.getUserLevel();
        if (level == null || level.getGradeCode() == null) {
            return false;
        }
        short code = level.getGradeCode();
        return code == GRADE_ADMIN || code == GRADE_SUPER_ADMIN;
    }

    private void requireAdmin(User user) {
        if (!isAdmin(user)) {
            throw new AccessDeniedException("관리자 권한이 필요합니다.");
        }
    }

    private int normalizePage(Integer page) {
        int p = (page == null ? 1 : page);
        return Math.max(1, p);
    }

    private int normalizeSize(Integer size) {
        int s = (size == null ? 10 : size);
        // 과도한 size 방지 (운영 기준)
        if (s < 1) return 10;
        return Math.min(s, 100);
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + "은(는) 필수입니다.");
        }
        return value.trim();
    }

    private Boolean parseStatusToIsProcessed(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String s = status.trim().toUpperCase();
        return switch (s) {
            case "PROCESSING" -> Boolean.FALSE;
            case "DONE" -> Boolean.TRUE;
            default -> throw new IllegalArgumentException("status는 PROCESSING 또는 DONE만 허용됩니다.");
        };
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

        // 타입 필터
        if (inquiryType != null && !inquiryType.isBlank()) {
            predicates.add(cb.equal(typeJoin.get("typeCode"), inquiryType.trim()));
        }

        // 상태 필터
        Boolean isProcessed = parseStatusToIsProcessed(status);
        if (isProcessed != null) {
            predicates.add(cb.equal(root.get("isProcessed"), isProcessed));
        }

        boolean mineOnly = Boolean.TRUE.equals(mine);

        if (admin) {
            // ADMIN 이상: 전체 조회 가능 (mine=true면 내 문의만)
            if (mineOnly) {
                predicates.add(cb.equal(inquirerJoin.get("userSeq"), actorUserSeq));
            }
            return predicates;
        }

        // USER: 공개 글 + 본인 비공개 글만 노출한다.
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
