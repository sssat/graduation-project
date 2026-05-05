// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeAiSummaryArticleRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeAiSummaryArticle;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeAiSummaryArticleRepository extends JpaRepository<AnalyzeAiSummaryArticle, Long> {

    /**
     * 요약에 사용된 기사들을 입력 순서대로 조회
     */
    List<AnalyzeAiSummaryArticle> findBySummarySeqOrderByInputOrderAsc(Long summarySeq);
}