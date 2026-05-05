// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataAnalyzeCoMentionNodeRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionNode;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeCoMentionNodeRepository extends JpaRepository<AnalyzeCoMentionNode, Long> {

    /**
     * 그래프의 노드 목록
     * - UI size에 쓸 node_weight가 커도, id는 NODE_SEQ 자체를 사용
     */
    List<AnalyzeCoMentionNode> findByGraphSeqOrderByNodeWeightDesc(Long graphSeq);
}