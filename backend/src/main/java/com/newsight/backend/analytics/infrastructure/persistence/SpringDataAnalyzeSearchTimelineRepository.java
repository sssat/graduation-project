package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.AnalyzeSearchTimeline;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataAnalyzeSearchTimelineRepository extends JpaRepository<AnalyzeSearchTimeline, Long> {

    List<AnalyzeSearchTimeline> findByKeywordSeqAndDataSourceOrderByObservedDateAsc(Long keywordSeq, String dataSource);
}
