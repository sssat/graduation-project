// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeMediaBiasRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeMediaBias;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeMediaBiasRepository extends JpaRepository<AnalyzeMediaBias, Long> {

    /**
     * (keyword + media + period) 기준 최신 run의 편향도 1건
     * - 키워드 상세 편향도(언론사별) 조회에선 mediaCode!=0 리스트를 쓰는 경우가 일반적
     */
    Optional<AnalyzeMediaBias> findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter
    );

    /**
     * 특정 run에서 키워드+기간의 언론사별 편향도 목록
     */
    List<AnalyzeMediaBias> findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
            Long trendRunSeq,
            Long keywordSeq,
            PeriodFilter periodFilter,
            Integer excludeMediaCode
    );
}