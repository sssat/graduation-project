// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeSentimentRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeSentiment;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeSentimentRepository extends JpaRepository<AnalyzeSentiment, Long> {

    /**
     * (keyword + media + period) 기준 최신 run의 감성 분석 1건
     * - mediaCode=0(전체)면 키워드 상세 감성(ALL)에서 사용
     */
    Optional<AnalyzeSentiment> findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter
    );

    /**
     * (keyword + period) 기준 최신 run의 언론사별 감성 분석 리스트
     * - mediaCode=0(전체) 제외 후 사용
     */
    List<AnalyzeSentiment> findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
            Long trendRunSeq,
            Long keywordSeq,
            PeriodFilter periodFilter,
            Integer excludeMediaCode
    );
}