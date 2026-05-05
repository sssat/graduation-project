package com.newsight.backend.analytics.application.service;

import com.newsight.backend.analytics.domain.model.AnalyzeMediaStat;
import com.newsight.backend.analytics.domain.model.AnalyzeSentiment;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloud;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloudItem;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.TrendKeywordFinalRank;
import com.newsight.backend.analytics.domain.model.WordcloudType;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeMediaStatRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeSentimentRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudItemRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudRepository;
import com.newsight.backend.common.exception.NotFoundException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class MediaCompareAnalyticsService {

    private final AnalyticsQuerySupport support;
    private final SpringDataAnalyzeMediaStatRepository analyzeMediaStatRepository;
    private final SpringDataAnalyzeSentimentRepository analyzeSentimentRepository;
    private final SpringDataAnalyzeWordcloudRepository analyzeWordcloudRepository;
    private final SpringDataAnalyzeWordcloudItemRepository analyzeWordcloudItemRepository;

    AnalyticsService.MediaCompareTopKeywordsResult getMediaCompareTopKeywords(String period, Integer limit) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        int resolvedLimit = support.normalizePositive(limit, AnalyticsQuerySupport.DEFAULT_LIMIT, 1, 50);

        TrendRunRef latestRun = support.getConfiguredTrendRunOrThrow();
        AnalyticsQuerySupport.PeriodRange fallbackRange = support.toPeriodRange(latestRun.getBaseDate(), pf);

        List<TrendKeywordFinalRank> d7Ranks = support.findFinalRanksByRunAndPeriod(latestRun.getTrendRunSeq(), PeriodFilter.D7);

        Map<Long, Integer> d7ArticleCountMap = d7Ranks.stream()
                .collect(Collectors.toMap(
                        TrendKeywordFinalRank::getKeywordSeq,
                        r -> r.getArticleCount() == null ? 0 : r.getArticleCount(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<TrendKeywordFinalRank> periodRanks = support.findFinalRanksByRunAndPeriod(latestRun.getTrendRunSeq(), pf);

        Map<Long, Integer> periodArticleCountMap = periodRanks.stream()
                .collect(Collectors.toMap(
                        TrendKeywordFinalRank::getKeywordSeq,
                        r -> r.getArticleCount() == null ? 0 : r.getArticleCount(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<TrendKeywordFinalRank> d7VisibleTop = d7Ranks.stream()
                .filter(r -> d7ArticleCountMap.getOrDefault(r.getKeywordSeq(), 0) >= AnalyticsQuerySupport.ANALYZABLE_MIN_ARTICLE_COUNT)
                .limit(resolvedLimit)
                .toList();

        List<TrendKeywordFinalRank> top = pf == PeriodFilter.D7
                ? d7VisibleTop
                : d7VisibleTop.stream()
                .sorted(
                        Comparator
                                .comparingInt(
                                        (TrendKeywordFinalRank r) ->
                                                periodArticleCountMap.getOrDefault(r.getKeywordSeq(), 0)
                                )
                                .reversed()
                                .thenComparingInt(TrendKeywordFinalRank::getFinalRank)
                )
                .toList();

        Map<Long, String> keywordNameMap = support.loadKeywordNameMap(
                top.stream().map(TrendKeywordFinalRank::getKeywordSeq).toList()
        );

        List<AnalyticsService.KeywordPillItem> items = top.stream()
                .map(r -> new AnalyticsService.KeywordPillItem(
                        r.getKeywordSeq(),
                        keywordNameMap.getOrDefault(r.getKeywordSeq(), "(unknown)")
                ))
                .toList();

        Long selectedKeywordSeq = top.isEmpty() ? null : top.get(0).getKeywordSeq();
        String selectedKeyword = selectedKeywordSeq == null ? null : keywordNameMap.getOrDefault(selectedKeywordSeq, "(unknown)");
        Integer selectedArticleCount = top.isEmpty()
                ? null
                : periodArticleCountMap.getOrDefault(selectedKeywordSeq, 0);

        Integer selectedMediaCount = null;
        if (selectedKeywordSeq != null) {
            long c = analyzeMediaStatRepository.countDistinctMediaCode(
                    latestRun.getTrendRunSeq(),
                    selectedKeywordSeq,
                    pf,
                    AnalyticsQuerySupport.ALL_MEDIA_CODE
            );
            selectedMediaCount = (int) c;
        }

        AnalyticsQuerySupport.PeriodRange displayRange = selectedKeywordSeq == null
                ? fallbackRange
                : support.resolveActualPublishedRangeOrFallback(
                        latestRun.getTrendRunSeq(),
                        selectedKeywordSeq,
                        pf,
                        latestRun.getBaseDate()
                );

        return new AnalyticsService.MediaCompareTopKeywordsResult(
                displayRange.start().toString(),
                displayRange.end().toString(),
                selectedKeyword,
                selectedArticleCount,
                selectedMediaCount,
                selectedKeywordSeq,
                items
        );
    }

    AnalyticsService.MediaArticleCountsResult getMediaArticleCounts(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeMediaStat all = analyzeMediaStatRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE,
                        pf
                )
                .orElseThrow(() -> new NotFoundException("매체별 기사 수 데이터가 없습니다."));

        List<AnalyzeMediaStat> rows = analyzeMediaStatRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        all.getTrendRunSeq(),
                        keywordSeq,
                        pf,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = support.loadMediaNameMap(
                rows.stream().map(AnalyzeMediaStat::getMediaCode).distinct().toList()
        );

        List<AnalyticsService.MediaArticleCountItem> items = rows.stream()
                .map(r -> new AnalyticsService.MediaArticleCountItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        r.getArticleCount() == null ? 0 : r.getArticleCount()
                ))
                .toList();

        return new AnalyticsService.MediaArticleCountsResult(items);
    }

    AnalyticsService.MediaSentimentCompareResult getMediaCompareContentSentiment(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment all = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE,
                        pf
                )
                .orElseThrow(() -> new NotFoundException("감성 분석 데이터가 없습니다."));

        List<AnalyzeSentiment> rows = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        all.getTrendRunSeq(),
                        keywordSeq,
                        pf,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = support.loadMediaNameMap(
                rows.stream().map(AnalyzeSentiment::getMediaCode).distinct().toList()
        );

        List<AnalyticsService.MediaSentimentItem> items = rows.stream()
                .map(r -> new AnalyticsService.MediaSentimentItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        support.toDouble(r.getPositivePctContent()),
                        support.toDouble(r.getNeutralPctContent()),
                        support.toDouble(r.getNegativePctContent())
                ))
                .toList();

        return new AnalyticsService.MediaSentimentCompareResult(items);
    }

    AnalyticsService.MediaTopWordsResult getMediaCompareTitleTopWords(Long keywordSeq, String period, Integer topN) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        int resolvedTopN = support.normalizePositive(topN, AnalyticsQuerySupport.DEFAULT_TOP_N, 1, 30);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        List<AnalyzeWordcloud> headers = analyzeWordcloudRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndWcTypeAndMediaCodeNotOrderByMediaCodeAsc(
                        selectedRunSeq,
                        keywordSeq,
                        pf,
                        WordcloudType.TITLE,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = support.loadMediaNameMap(
                headers.stream().map(AnalyzeWordcloud::getMediaCode).distinct().toList()
        );

        List<AnalyticsService.MediaTopWordsItem> items = new ArrayList<>();

        for (AnalyzeWordcloud h : headers) {
            List<AnalyzeWordcloudItem> topItems = analyzeWordcloudItemRepository
                    .findByWcSeqOrderByRankNoAsc(h.getWcSeq(), PageRequest.of(0, resolvedTopN));

            List<String> words = topItems.stream()
                    .map(AnalyzeWordcloudItem::getWordText)
                    .filter(Objects::nonNull)
                    .toList();

            items.add(new AnalyticsService.MediaTopWordsItem(
                    mediaNameMap.getOrDefault(h.getMediaCode(), "(unknown)"),
                    words
            ));
        }

        items.sort(Comparator.comparing(AnalyticsService.MediaTopWordsItem::mediaName));

        return new AnalyticsService.MediaTopWordsResult(items);
    }
}
