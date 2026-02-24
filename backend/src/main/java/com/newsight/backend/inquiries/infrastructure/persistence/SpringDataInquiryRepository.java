// backend/src/main/java/com/newsight/backend/inquiries/infrastructure/persistence/SpringDataInquiryRepository.java
package com.newsight.backend.inquiries.infrastructure.persistence;

import com.newsight.backend.inquiries.domain.model.Inquiry;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.Query;

public interface SpringDataInquiryRepository extends JpaRepository<Inquiry, Long> {

    /**
     * 관리자/작성자 권한 체크 전 "내 문의" 존재 확인 등에 사용 가능
     */
    boolean existsByInquirySeqAndInquirer_UserSeq(Long inquirySeq, Long inquirerSeq);

    /**
     * 내 문의 목록(최신순)
     * - DDL에 SUBMITTED_AT 인덱스가 있어 최신순 정렬이 일반적인 조회에 유리함
     */
    Page<Inquiry> findByInquirer_UserSeqOrderBySubmittedAtDesc(Long inquirerSeq, Pageable pageable);

    /**
     * 처리상태 필터 + 최신순
     * - is_processed 인덱스 활용
     */
    Page<Inquiry> findByIsProcessedOrderBySubmittedAtDesc(boolean isProcessed, Pageable pageable);

    /**
     * 문의 유형 필터 + 최신순
     * - type_code 인덱스 활용
     */
    Page<Inquiry> findByType_TypeCodeOrderBySubmittedAtDesc(String typeCode, Pageable pageable);

    /**
     * 문의 유형 + 처리상태 + 최신순 (관리자 목록 화면에서 가장 흔한 조합)
     */
    Page<Inquiry> findByType_TypeCodeAndIsProcessedOrderBySubmittedAtDesc(
            String typeCode,
            boolean isProcessed,
            Pageable pageable
    );

    /**
     * 상세 조회에서 연관 엔티티(LAZY) 때문에 N+1이 걱정되면 서비스에서 fetch join 쿼리로 교체할 수 있음.
     * 일단은 기본 Optional 조회 제공.
     */
    Optional<Inquiry> findByInquirySeq(Long inquirySeq);

    /**
     * 처리 중 문의 수
     */
    long countByIsProcessedFalse();

    /**
     * 처리 중 문의의 submitted_at 목록
     * - 평균 경과 일수 계산용
     */
    @Query("select i.submittedAt from Inquiry i where i.isProcessed = false")
    List<LocalDateTime> findSubmittedAtByIsProcessedFalse();
}