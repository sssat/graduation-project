// backend/src/main/java/com/newsight/backend/inquiries/infrastructure/persistence/SpringDataInquiryTypeRepository.java
package com.newsight.backend.inquiries.infrastructure.persistence;

import com.newsight.backend.inquiries.domain.model.InquiryType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataInquiryTypeRepository extends JpaRepository<InquiryType, String> {

    Optional<InquiryType> findByTypeName(String typeName);

    boolean existsByTypeName(String typeName);

    /**
     * seed에 SORT_ORDER 인덱스가 있으니, 화면에서 문의유형 목록이 필요하면 정렬된 형태로 뽑기 좋다.
     */
    List<InquiryType> findAllByOrderBySortOrderAsc();
}