// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataTrendKeywordMasterRefRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataTrendKeywordMasterRefRepository extends JpaRepository<TrendKeywordMasterRef, Long> {

    Optional<TrendKeywordMasterRef> findByKeywordName(String keywordName);
}