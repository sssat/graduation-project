// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataTrendRunRefRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataTrendRunRefRepository extends JpaRepository<TrendRunRef, Long> {

    /**
     * 최신 트렌드 run 1건
     */
    Optional<TrendRunRef> findFirstByOrderByTrendRunSeqDesc();

    Optional<TrendRunRef> findFirstByPublishedTrueOrderByTrendRunSeqDesc();

    /**
     * 특정 baseDate의 최신 run 1건
     */
    Optional<TrendRunRef> findFirstByBaseDateOrderByTrendRunSeqDesc(LocalDate baseDate);

    Optional<TrendRunRef> findFirstByPublishedTrueAndBaseDateOrderByTrendRunSeqDesc(LocalDate baseDate);
}
