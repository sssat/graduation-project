// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeCoMentionGraphRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionGraph;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeCoMentionGraphRepository extends JpaRepository<AnalyzeCoMentionGraph, Long> {

    /**
     * (keyword + media + period) 기준 최신 run의 그래프 헤더 1건
     * - 보통 mediaCode=0(전체)로 키워드 상세 공동언급 네트워크를 제공
     */
    Optional<AnalyzeCoMentionGraph> findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter
    );
}