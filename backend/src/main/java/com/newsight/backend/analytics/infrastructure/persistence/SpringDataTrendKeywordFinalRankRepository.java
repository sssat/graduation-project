// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataTrendKeywordFinalRankRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.TrendKeywordFinalRank;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataTrendKeywordFinalRankRepository extends JpaRepository<TrendKeywordFinalRank, Long> {

    /**
     * 키워드 + 기간 기준 최신 run의 최종 순위 1건(대개 랭킹 목록 조회 시엔 run 단위로 조회)
     */
    Optional<TrendKeywordFinalRank> findFirstByKeywordSeqAndPeriodFilterOrderByTrendRunSeqDesc(
            Long keywordSeq,
            PeriodFilter periodFilter
    );

    /**
     * 특정 run + period에서 랭킹 목록(오름차순)
     */
    List<TrendKeywordFinalRank> findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(
            Long trendRunSeq,
            PeriodFilter periodFilter
    );
}