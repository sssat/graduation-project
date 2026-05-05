// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeWordcloudItemRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeWordcloudItem;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeWordcloudItemRepository extends JpaRepository<AnalyzeWordcloudItem, Long> {

    /**
     * 워드클라우드 아이템 전체(랭킹 오름차순)
     */
    List<AnalyzeWordcloudItem> findByWcSeqOrderByRankNoAsc(Long wcSeq);

    /**
     * 상위 N개 단어 조회용 (Pageable로 limit 처리)
     * - 예: PageRequest.of(0, topN)
     */
    List<AnalyzeWordcloudItem> findByWcSeqOrderByRankNoAsc(Long wcSeq, Pageable pageable);
}