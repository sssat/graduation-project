// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataTrendRunRefRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataTrendRunRefRepository extends JpaRepository<TrendRunRef, Long> {

    /**
     * 최신 트렌드 run 1건
     */
    Optional<TrendRunRef> findFirstByOrderByTrendRunSeqDesc();

    List<TrendRunRef> findByRunStatusOrderByTrendRunSeqDesc(String runStatus);

    /**
     * 특정 baseDate의 최신 run 1건
     */
    Optional<TrendRunRef> findFirstByBaseDateOrderByTrendRunSeqDesc(LocalDate baseDate);

    @Query(
            value = """
                    SELECT CONCAT(DATE_FORMAT(RUN_AT, '%Y-%m-%dT%H:%i:%s'), '+09:00')
                    FROM T_TREND_RUN
                    WHERE TREND_RUN_SEQ = :trendRunSeq
                    """,
            nativeQuery = true
    )
    Optional<String> findRunAtKstTextByTrendRunSeq(@Param("trendRunSeq") Long trendRunSeq);
}
