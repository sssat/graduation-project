package com.newsight.backend.analytics.application.service;

import com.newsight.backend.analytics.domain.model.AnalyzeAiSummary;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionEdge;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionGraph;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionNode;
import com.newsight.backend.analytics.domain.model.AnalyzeMediaBias;
import com.newsight.backend.analytics.domain.model.AnalyzeSearchTimeline;
import com.newsight.backend.analytics.domain.model.AnalyzeSentiment;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloud;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloudItem;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.WordcloudType;
import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeAiSummaryRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionEdgeRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionGraphRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionNodeRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeMediaStatRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeMediaBiasRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeSearchTimelineRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeSentimentRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudItemRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudRepository;
import com.newsight.backend.common.exception.NotFoundException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class KeywordAnalyticsService {

    private final AnalyticsQuerySupport support;
    private final SpringDataAnalyzeAiSummaryRepository analyzeAiSummaryRepository;
    private final SpringDataAnalyzeMediaStatRepository analyzeMediaStatRepository;
    private final SpringDataAnalyzeSearchTimelineRepository analyzeSearchTimelineRepository;
    private final SpringDataAnalyzeWordcloudRepository analyzeWordcloudRepository;
    private final SpringDataAnalyzeWordcloudItemRepository analyzeWordcloudItemRepository;
    private final SpringDataAnalyzeSentimentRepository analyzeSentimentRepository;
    private final SpringDataAnalyzeMediaBiasRepository analyzeMediaBiasRepository;
    private final SpringDataAnalyzeCoMentionGraphRepository analyzeCoMentionGraphRepository;
    private final SpringDataAnalyzeCoMentionNodeRepository analyzeCoMentionNodeRepository;
    private final SpringDataAnalyzeCoMentionEdgeRepository analyzeCoMentionEdgeRepository;

    AnalyticsService.KeywordMetaResult getKeywordMeta(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        TrendKeywordMasterRef keyword = support.getKeywordOrThrow(keywordSeq);

        TrendRunRef latestRun = support.getConfiguredTrendRunOrThrow();
        Long latestRunSeq = latestRun.getTrendRunSeq();
        AnalyticsQuerySupport.PeriodRange range = support.resolveActualPublishedRangeOrFallback(
                latestRunSeq,
                keywordSeq,
                pf,
                latestRun.getBaseDate()
        );

        int articleCount = support.getFinalRankArticleCountForRun(latestRunSeq, keywordSeq, pf).orElse(0);
        long mediaCount = analyzeMediaStatRepository.countDistinctMediaCode(
                latestRunSeq,
                keywordSeq,
                pf,
                AnalyticsQuerySupport.ALL_MEDIA_CODE
        );
        boolean analyzable = support.isAnalyzable(latestRunSeq, keywordSeq);

        return new AnalyticsService.KeywordMetaResult(
                keywordSeq,
                keyword.getKeywordName(),
                range.start().toString(),
                range.end().toString(),
                articleCount,
                (int) mediaCount,
                analyzable
        );
    }

    AnalyticsService.SummaryResult getAiSummary(Long keywordSeq, String period) {
        support.parsePeriodFilter(period);

        Long selectedRunSeq = support.getConfiguredTrendRunSeq();
        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeAiSummary summary = analyzeAiSummaryRepository.findByTrendRunSeqAndKeywordSeq(selectedRunSeq, keywordSeq)
                .orElseThrow(() -> new NotFoundException("AI 요약 데이터가 없습니다."));

        return new AnalyticsService.SummaryResult(summary.getSummaryText());
    }

    AnalyticsService.WordcloudResult getTitleWordcloud(Long keywordSeq, String period) {
        return getWordcloud(keywordSeq, period, WordcloudType.TITLE);
    }

    AnalyticsService.WordcloudResult getCommentWordcloud(Long keywordSeq, String period) {
        return getWordcloud(keywordSeq, period, WordcloudType.COMMENT);
    }

    AnalyticsService.SearchTimelineResult getSearchTimeline(Long keywordSeq, String ignoredPeriod) {
        support.getKeywordOrThrow(keywordSeq);

        Long selectedRunSeq = support.getConfiguredTrendRunSeq();
        List<AnalyzeSearchTimeline> rows = analyzeSearchTimelineRepository
                .findByTrendRunSeqAndKeywordSeqAndDataSourceOrderByObservedDateAsc(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.SEARCH_TIMELINE_DATA_SOURCE
                );

        if (rows.isEmpty()) {
            return new AnalyticsService.SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        LocalDate latestObservedDate = rows.stream()
                .map(AnalyzeSearchTimeline::getObservedDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);

        if (latestObservedDate == null) {
            return new AnalyticsService.SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        LocalDate requestedStartDate = latestObservedDate.minusMonths(AnalyticsQuerySupport.SEARCH_TIMELINE_LOOKBACK_MONTHS);

        List<AnalyticsService.SearchTimelinePoint> items = rows.stream()
                .filter(r -> r.getObservedDate() != null)
                .filter(r -> !r.getObservedDate().isBefore(requestedStartDate) && !r.getObservedDate().isAfter(latestObservedDate))
                .map(r -> new AnalyticsService.SearchTimelinePoint(
                        r.getObservedDate().toString(),
                        r.getInterestScore() == null ? 0 : r.getInterestScore(),
                        Boolean.TRUE.equals(r.getIsPartial())
                ))
                .toList();

        if (items.isEmpty()) {
            return new AnalyticsService.SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        String actualStart = items.get(0).observedDate();
        String actualEnd = items.get(items.size() - 1).observedDate();
        Integer latestScore = items.get(items.size() - 1).interestScore();
        Integer peakScore = items.stream()
                .map(AnalyticsService.SearchTimelinePoint::interestScore)
                .max(Integer::compareTo)
                .orElse(null);
        Double averageScore = support.round1(items.stream().mapToInt(AnalyticsService.SearchTimelinePoint::interestScore).average().orElse(0.0));
        boolean hasPartial = items.stream().anyMatch(AnalyticsService.SearchTimelinePoint::isPartial);

        return new AnalyticsService.SearchTimelineResult(
                actualStart,
                actualEnd,
                latestScore,
                peakScore,
                averageScore,
                hasPartial,
                items
        );
    }

    AnalyticsService.SentimentResult getContentSentiment(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment sentiment = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE,
                        pf
                )
                .orElseThrow(() -> new NotFoundException("감성 분석 데이터가 없습니다."));

        return new AnalyticsService.SentimentResult(
                support.toDouble(sentiment.getPositivePctContent()),
                support.toDouble(sentiment.getNeutralPctContent()),
                support.toDouble(sentiment.getNegativePctContent())
        );
    }

    AnalyticsService.BiasByMediaResult getTitleBiasByMedia(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        List<AnalyzeMediaBias> rows = analyzeMediaBiasRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        selectedRunSeq,
                        keywordSeq,
                        pf,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = support.loadMediaNameMap(
                rows.stream().map(AnalyzeMediaBias::getMediaCode).distinct().toList()
        );

        List<AnalyticsService.BiasByMediaItem> items = rows.stream()
                .map(r -> new AnalyticsService.BiasByMediaItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        support.toDouble(r.getBiasScoreTitle())
                ))
                .toList();

        return new AnalyticsService.BiasByMediaResult(items);
    }

    AnalyticsService.BiasByMediaResult getContentBiasByMedia(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        List<AnalyzeMediaBias> rows = analyzeMediaBiasRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        selectedRunSeq,
                        keywordSeq,
                        pf,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = support.loadMediaNameMap(
                rows.stream().map(AnalyzeMediaBias::getMediaCode).distinct().toList()
        );

        List<AnalyticsService.BiasByMediaItem> items = rows.stream()
                .map(r -> new AnalyticsService.BiasByMediaItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        support.toDouble(r.getBiasScoreContent())
                ))
                .toList();

        return new AnalyticsService.BiasByMediaResult(items);
    }

    AnalyticsService.CoocNetworkResult getCoocNetwork(Long keywordSeq, String period) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeCoMentionGraph graph = analyzeCoMentionGraphRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE,
                        pf
                )
                .orElse(null);

        if (graph == null) {
            return new AnalyticsService.CoocNetworkResult(List.of(), List.of());
        }

        List<AnalyzeCoMentionNode> nodes = analyzeCoMentionNodeRepository.findByGraphSeqOrderByNodeWeightDesc(graph.getGraphSeq());
        List<AnalyzeCoMentionEdge> edges = analyzeCoMentionEdgeRepository.findByGraphSeqOrderByEdgeWeightDesc(graph.getGraphSeq());

        List<AnalyticsService.NodeItem> nodeItems = nodes.stream()
                .map(n -> new AnalyticsService.NodeItem(
                        n.getNodeSeq(),
                        n.getEntityName(),
                        support.toDouble(n.getNodeWeight())
                ))
                .toList();

        List<AnalyticsService.EdgeItem> edgeItems = edges.stream()
                .map(e -> new AnalyticsService.EdgeItem(
                        e.getFromNodeSeq(),
                        e.getToNodeSeq(),
                        support.toDouble(e.getEdgeWeight())
                ))
                .toList();

        return new AnalyticsService.CoocNetworkResult(nodeItems, edgeItems);
    }

    private AnalyticsService.WordcloudResult getWordcloud(Long keywordSeq, String period, WordcloudType wcType) {
        PeriodFilter pf = support.parsePeriodFilter(period);
        Long selectedRunSeq = support.getConfiguredTrendRunSeq();

        support.requireAnalyzable(selectedRunSeq, keywordSeq);
        support.getKeywordOrThrow(keywordSeq);

        AnalyzeWordcloud wc = analyzeWordcloudRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilterAndWcType(
                        selectedRunSeq,
                        keywordSeq,
                        AnalyticsQuerySupport.ALL_MEDIA_CODE,
                        pf,
                        wcType
                )
                .orElseThrow(() -> new NotFoundException("워드클라우드 데이터가 없습니다."));

        List<AnalyzeWordcloudItem> items = analyzeWordcloudItemRepository.findByWcSeqOrderByRankNoAsc(wc.getWcSeq());

        List<AnalyticsService.WordItem> wordItems = items.stream()
                .map(i -> new AnalyticsService.WordItem(
                        i.getWordText(),
                        support.toDouble(i.getWeight())
                ))
                .toList();

        return new AnalyticsService.WordcloudResult(wordItems);
    }
}
