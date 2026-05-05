package com.newsight.backend.analytics.application.service;

import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.TrendKeywordFinalRank;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class AnalyticsOverviewService {

    private final AnalyticsQuerySupport support;

    AnalyticsService.OverviewResult getOverview() {
        TrendRunRef selectedRun = support.getConfiguredTrendRunOrThrow();
        Long selectedRunSeq = selectedRun.getTrendRunSeq();

        long collectedArticleCount = support.sumAllKeywordArticleCount(selectedRunSeq, PeriodFilter.D14);

        List<TrendKeywordFinalRank> top10 = support.findFinalRanksByRunAndPeriod(selectedRunSeq, PeriodFilter.D7)
                .stream()
                .limit(AnalyticsQuerySupport.DEFAULT_LIMIT)
                .toList();

        Map<Long, String> keywordNameMap = support.loadKeywordNameMap(
                top10.stream().map(TrendKeywordFinalRank::getKeywordSeq).toList()
        );

        List<AnalyticsService.TopKeywordItem> topKeywords = top10.stream()
                .map(r -> new AnalyticsService.TopKeywordItem(
                        r.getFinalRank(),
                        r.getKeywordSeq(),
                        keywordNameMap.getOrDefault(r.getKeywordSeq(), "(unknown)"),
                        r.getArticleCount(),
                        r.getArticleCount() >= AnalyticsQuerySupport.ANALYZABLE_MIN_ARTICLE_COUNT
                ))
                .toList();

        return new AnalyticsService.OverviewResult(
                collectedArticleCount,
                selectedRun.getBaseDate() == null ? null : selectedRun.getBaseDate().toString(),
                support.formatStartedAt(selectedRunSeq, selectedRun.getRunAt()),
                topKeywords
        );
    }
}
