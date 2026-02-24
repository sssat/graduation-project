// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeAiSummaryRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeAiSummary;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeAiSummaryRepository extends JpaRepository<AnalyzeAiSummary, Long> {

    /**
     * 요약은 period_filter와 무관(run 단위로 1개) 설계이므로
     * keyword 기준 최신 run 요약 1개를 가져오는 형태가 일반적
     */
    Optional<AnalyzeAiSummary> findFirstByKeywordSeqOrderByTrendRunSeqDesc(Long keywordSeq);

    Optional<AnalyzeAiSummary> findByTrendRunSeqAndKeywordSeq(Long trendRunSeq, Long keywordSeq);
}