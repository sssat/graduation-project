// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeCoMentionEdgeRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionEdge;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeCoMentionEdgeRepository extends JpaRepository<AnalyzeCoMentionEdge, Long> {

    /**
     * 그래프의 엣지 목록
     */
    List<AnalyzeCoMentionEdge> findByGraphSeqOrderByEdgeWeightDesc(Long graphSeq);
}