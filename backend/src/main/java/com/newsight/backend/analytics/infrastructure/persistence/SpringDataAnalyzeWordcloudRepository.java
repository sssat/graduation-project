// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeWordcloudRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeWordcloud;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.WordcloudType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeWordcloudRepository extends JpaRepository<AnalyzeWordcloud, Long> {

    /**
     * (keyword + media + period + type) 기준 최신 run의 워드클라우드 헤더 1건
     * - mediaCode=0(전체)면 키워드 상세 워드클라우드에서 사용
     */
    Optional<AnalyzeWordcloud> findFirstByKeywordSeqAndMediaCodeAndPeriodFilterAndWcTypeOrderByTrendRunSeqDesc(
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter,
            WordcloudType wcType
    );

    /**
     * 특정 run에서 키워드+기간+type의 언론사별 워드클라우드 헤더 리스트
     * - mediaCode=0(전체) 제외 후 사용
     */
    List<AnalyzeWordcloud> findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndWcTypeAndMediaCodeNotOrderByMediaCodeAsc(
            Long trendRunSeq,
            Long keywordSeq,
            PeriodFilter periodFilter,
            WordcloudType wcType,
            Integer excludeMediaCode
    );

    Optional<AnalyzeWordcloud> findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilterAndWcType(
            Long trendRunSeq,
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter,
            WordcloudType wcType
    );
}
