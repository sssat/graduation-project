// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeMediaStatRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeMediaStat;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeMediaStatRepository extends JpaRepository<AnalyzeMediaStat, Long> {

    /**
     * (keyword + media + period) 기준 최신 run의 통계 1건
     * - mediaCode=0을 "전체(ALL)"로 쓰는 경우: 헤더(article_count) 조회에 사용
     */
    Optional<AnalyzeMediaStat> findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter
    );

    /**
     * 특정 run에서 키워드+기간의 언론사별 통계 목록
     * - mediaCode=0(전체)을 제외한 언론사별 rows를 뽑는 용도
     */
    List<AnalyzeMediaStat> findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
            Long trendRunSeq,
            Long keywordSeq,
            PeriodFilter periodFilter,
            Integer excludeMediaCode
    );

    Optional<AnalyzeMediaStat> findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(
            Long trendRunSeq,
            Long keywordSeq,
            Integer mediaCode,
            PeriodFilter periodFilter
    );

    /**
     * 특정 run에서 키워드+기간 기준 "참여 언론사 수" (article_count > 0인 media만)
     * - 보통 mediaCode=0(전체)은 제외하고 계산
     */
    @Query("""
            select count(distinct s.mediaCode)
              from AnalyzeMediaStat s
             where s.trendRunSeq = :trendRunSeq
               and s.keywordSeq = :keywordSeq
               and s.periodFilter = :periodFilter
               and s.mediaCode <> :excludeMediaCode
               and s.articleCount > 0
            """)
    long countDistinctMediaCode(
            @Param("trendRunSeq") Long trendRunSeq,
            @Param("keywordSeq") Long keywordSeq,
            @Param("periodFilter") PeriodFilter periodFilter,
            @Param("excludeMediaCode") Integer excludeMediaCode
    );
}
