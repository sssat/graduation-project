// backend/src/main/java/com/newsight/backend/analytics/application/service/AnalyticsService.java
package com.newsight.backend.analytics.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.analytics.domain.model.AnalyzeAiSummary;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionEdge;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionGraph;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionNode;
import com.newsight.backend.analytics.domain.model.AnalyzeSearchTimeline;
import com.newsight.backend.analytics.domain.model.AnalyzeMediaBias;
import com.newsight.backend.analytics.domain.model.AnalyzeMediaStat;
import com.newsight.backend.analytics.domain.model.AnalyzeSentiment;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloud;
import com.newsight.backend.analytics.domain.model.AnalyzeWordcloudItem;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.TrendKeywordFinalRank;
import com.newsight.backend.analytics.domain.model.WordcloudType;
import com.newsight.backend.analytics.domain.model.reference.NewsMediaRef;
import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeAiSummaryRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionEdgeRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionGraphRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeCoMentionNodeRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeSearchTimelineRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeMediaBiasRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeMediaStatRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeSentimentRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudItemRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataAnalyzeWordcloudRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataNewsMediaRefRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataTrendKeywordFinalRankRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataTrendKeywordMasterRefRepository;
import com.newsight.backend.analytics.infrastructure.persistence.SpringDataTrendRunRefRepository;
import com.newsight.backend.common.exception.ConflictException;
import com.newsight.backend.common.exception.NotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AnalyticsService {

    private static final int ANALYZABLE_MIN_ARTICLE_COUNT = 10;
    private static final int DEFAULT_LIMIT = 10;
    private static final int DEFAULT_TOP_N = 5;
    private static final int ALL_MEDIA_CODE = 0;
    private static final long SEARCH_TIMELINE_LOOKBACK_MONTHS = 3L;
    private static final String SEARCH_TIMELINE_DATA_SOURCE = "NAVER_DATALAB";
    private static final DateTimeFormatter KST_RUN_AT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'+09:00'");

    private final SpringDataTrendRunRefRepository trendRunRefRepository;
    private final SpringDataTrendKeywordMasterRefRepository trendKeywordMasterRefRepository;
    private final SpringDataTrendKeywordFinalRankRepository trendKeywordFinalRankRepository;

    private final SpringDataAnalyzeMediaStatRepository analyzeMediaStatRepository;
    private final SpringDataAnalyzeAiSummaryRepository analyzeAiSummaryRepository;
    private final SpringDataAnalyzeSearchTimelineRepository analyzeSearchTimelineRepository;
    private final SpringDataAnalyzeWordcloudRepository analyzeWordcloudRepository;
    private final SpringDataAnalyzeWordcloudItemRepository analyzeWordcloudItemRepository;
    private final SpringDataAnalyzeSentimentRepository analyzeSentimentRepository;
    private final SpringDataAnalyzeMediaBiasRepository analyzeMediaBiasRepository;
    private final SpringDataAnalyzeCoMentionGraphRepository analyzeCoMentionGraphRepository;
    private final SpringDataAnalyzeCoMentionNodeRepository analyzeCoMentionNodeRepository;
    private final SpringDataAnalyzeCoMentionEdgeRepository analyzeCoMentionEdgeRepository;

    private final SpringDataNewsMediaRefRepository newsMediaRefRepository;

    private final SpringDataUserRepository userRepository;
    private final Clock clock;

    @Value("${app.analytics.trend-run-offset:0}")
    private int analyticsTrendRunOffset;

    @PersistenceContext
    private EntityManager em;

    /**
     * GET /api/analytics/overview/
     * - collected_article_count: ALL + D14 기준 전체 기사 수(최종랭크 테이블 합계)
     * - top_keywords: ALL + D7 기준 TOP10
     */
    public OverviewResult getOverview() {
        TrendRunRef selectedRun = getConfiguredTrendRunOrThrow();
        Long selectedRunSeq = selectedRun.getTrendRunSeq();

        long collectedArticleCount = sumAllKeywordArticleCount(selectedRunSeq, PeriodFilter.D14);

        List<TrendKeywordFinalRank> topRanks =
                trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(selectedRunSeq, PeriodFilter.D7);

        List<TrendKeywordFinalRank> top10 = topRanks.stream()
                .limit(DEFAULT_LIMIT)
                .toList();

        Map<Long, String> keywordNameMap = loadKeywordNameMap(
                top10.stream().map(TrendKeywordFinalRank::getKeywordSeq).toList()
        );

        List<TopKeywordItem> topKeywords = top10.stream()
                .map(r -> new TopKeywordItem(
                        r.getFinalRank(),
                        r.getKeywordSeq(),
                        keywordNameMap.getOrDefault(r.getKeywordSeq(), "(unknown)"),
                        r.getArticleCount(),
                        r.getArticleCount() >= ANALYZABLE_MIN_ARTICLE_COUNT
                ))
                .toList();

        return new OverviewResult(
                collectedArticleCount,
                selectedRun.getBaseDate() == null ? null : selectedRun.getBaseDate().toString(),
                formatStartedAt(selectedRunSeq, selectedRun.getRunAt()),
                topKeywords
        );
    }

    /**
     * GET /api/admins/dashboard/summary
     * - 관리자 이상만 조회 가능
     */
    public AdminDashboardSummaryResult getAdminDashboardSummary(Long actorUserSeq) {
        if (actorUserSeq == null) {
            throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
        }

        User actor = userRepository.findByUserSeq(actorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(actor) < 1) {
            throw new SecurityException("관리자만 접근할 수 있습니다.");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime endOfToday = startOfToday.plusDays(1);

        // 1) 오늘 가입자 수 + 최근 7일 평균 대비 증감률
        long todayJoinedCount = countUsersJoinedBetween(startOfToday, endOfToday);
        long past7JoinedTotal = countUsersJoinedBetween(startOfToday.minusDays(7), startOfToday);
        Double todayJoinedDeltaRate = calcDeltaRateVsAvg(todayJoinedCount, past7JoinedTotal, 7);

        // 2) 오늘 수집 기사 수(최신 run, ALL + D14 합산) + 지난주 동일 요일 대비 증감률
        TrendRunRef selectedRun = getConfiguredTrendRunOrThrow();
        long todayCollectedArticleCount = sumAllKeywordArticleCount(selectedRun.getTrendRunSeq(), PeriodFilter.D14);

        TrendRunRef lastWeekRun = findComparableTrendRunWithData(
                selectedRun.getBaseDate().minusDays(7),
                PeriodFilter.D14
        );

        Double todayCollectedArticleDeltaRate = null;
        if (lastWeekRun != null) {
            long lastWeekCount = sumAllKeywordArticleCount(lastWeekRun.getTrendRunSeq(), PeriodFilter.D14);
            todayCollectedArticleDeltaRate = calcDeltaRate(todayCollectedArticleCount, lastWeekCount);
        }

        // 3) 처리 중 문의 수 + 처리 중 문의 평균 경과 일수(일)
        long processingInquiryCount = countProcessingInquiries();
        Double processingInquiryAvgElapsedDays = calcProcessingInquiryAvgElapsedDays();

        return new AdminDashboardSummaryResult(
                todayJoinedCount,
                todayJoinedDeltaRate,
                todayCollectedArticleCount,
                todayCollectedArticleDeltaRate,
                processingInquiryCount,
                processingInquiryAvgElapsedDays
        );
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/?period=D7|D14
     */
    public KeywordMetaResult getKeywordMeta(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        TrendKeywordMasterRef keyword = getKeywordOrThrow(keywordSeq);

        TrendRunRef latestRun = getConfiguredTrendRunOrThrow();
        Long latestRunSeq = latestRun.getTrendRunSeq();
        PeriodRange range = resolveActualPublishedRangeOrFallback(
                latestRunSeq,
                keywordSeq,
                pf,
                latestRun.getBaseDate()
        );

        int articleCount = getFinalRankArticleCountForRun(latestRunSeq, keywordSeq, pf).orElse(0);
        long mediaCount = analyzeMediaStatRepository.countDistinctMediaCode(
                latestRunSeq,
                keywordSeq,
                pf,
                ALL_MEDIA_CODE
        );

        boolean analyzable = isAnalyzable(latestRunSeq, keywordSeq);

        return new KeywordMetaResult(
                keywordSeq,
                keyword.getKeywordName(),
                range.start().toString(),
                range.end().toString(),
                articleCount,
                (int) mediaCount,
                analyzable
        );
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/summary/?period=D7|D14
     */
    public SummaryResult getAiSummary(Long keywordSeq, String period) {
        parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeAiSummary summary = analyzeAiSummaryRepository.findByTrendRunSeqAndKeywordSeq(selectedRunSeq, keywordSeq)
                .orElseThrow(() -> new NotFoundException("AI 요약 데이터가 없습니다."));

        return new SummaryResult(summary.getSummaryText());
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/title/?period=D7|D14
     */
    public WordcloudResult getTitleWordcloud(Long keywordSeq, String period) {
        return getWordcloud(keywordSeq, period, WordcloudType.TITLE);
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/comment/?period=D7|D14
     */
    public WordcloudResult getCommentWordcloud(Long keywordSeq, String period) {
        return getWordcloud(keywordSeq, period, WordcloudType.COMMENT);
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/search-timeline
     * - period 쿼리가 들어와도 검색 관심도 타임라인은 최근 3개월 고정으로 반환한다.
     */
    public SearchTimelineResult getSearchTimeline(Long keywordSeq, String ignoredPeriod) {
        getKeywordOrThrow(keywordSeq);

        Long selectedRunSeq = getConfiguredTrendRunSeq();
        List<AnalyzeSearchTimeline> rows = analyzeSearchTimelineRepository
                .findByTrendRunSeqAndKeywordSeqAndDataSourceOrderByObservedDateAsc(
                        selectedRunSeq,
                        keywordSeq,
                        SEARCH_TIMELINE_DATA_SOURCE
                );

        if (rows.isEmpty()) {
            return new SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        LocalDate latestObservedDate = rows.stream()
                .map(AnalyzeSearchTimeline::getObservedDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);

        if (latestObservedDate == null) {
            return new SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        LocalDate requestedStartDate = latestObservedDate.minusMonths(SEARCH_TIMELINE_LOOKBACK_MONTHS);

        List<SearchTimelinePoint> items = rows.stream()
                .filter(r -> r.getObservedDate() != null)
                .filter(r -> !r.getObservedDate().isBefore(requestedStartDate) && !r.getObservedDate().isAfter(latestObservedDate))
                .map(r -> new SearchTimelinePoint(
                        r.getObservedDate().toString(),
                        r.getInterestScore() == null ? 0 : r.getInterestScore(),
                        Boolean.TRUE.equals(r.getIsPartial())
                ))
                .toList();

        if (items.isEmpty()) {
            return new SearchTimelineResult(null, null, null, null, null, false, List.of());
        }

        String actualStart = items.get(0).observedDate();
        String actualEnd = items.get(items.size() - 1).observedDate();

        Integer latestScore = items.isEmpty() ? null : items.get(items.size() - 1).interestScore();
        Integer peakScore = items.stream()
                .map(SearchTimelinePoint::interestScore)
                .max(Integer::compareTo)
                .orElse(null);
        Double averageScore = items.isEmpty()
                ? null
                : round1(items.stream().mapToInt(SearchTimelinePoint::interestScore).average().orElse(0.0));
        boolean hasPartial = items.stream().anyMatch(SearchTimelinePoint::isPartial);

        return new SearchTimelineResult(
                actualStart,
                actualEnd,
                latestScore,
                peakScore,
                averageScore,
                hasPartial,
                items
        );
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/sentiment/content/?period=D7|D14
     */
    public SentimentResult getContentSentiment(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment sentiment = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(selectedRunSeq, keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("감성 분석 데이터가 없습니다."));

        return new SentimentResult(
                toDouble(sentiment.getPositivePctContent()),
                toDouble(sentiment.getNeutralPctContent()),
                toDouble(sentiment.getNegativePctContent())
        );
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/bias/title/?period=D7|D14
     */
    public BiasByMediaResult getTitleBiasByMedia(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        List<AnalyzeMediaBias> rows = analyzeMediaBiasRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        selectedRunSeq,
                        keywordSeq,
                        pf,
                        ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = loadMediaNameMap(
                rows.stream().map(AnalyzeMediaBias::getMediaCode).distinct().toList()
        );

        List<BiasByMediaItem> items = rows.stream()
                .map(r -> new BiasByMediaItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        toDouble(r.getBiasScoreTitle())
                ))
                .toList();

        return new BiasByMediaResult(items);
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/cooc-network/?period=D7|D14
     */
    public CoocNetworkResult getCoocNetwork(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeCoMentionGraph graph = analyzeCoMentionGraphRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(selectedRunSeq, keywordSeq, ALL_MEDIA_CODE, pf)
                .orElse(null);

        if (graph == null) {
            return new CoocNetworkResult(List.of(), List.of());
        }

        List<AnalyzeCoMentionNode> nodes = analyzeCoMentionNodeRepository
                .findByGraphSeqOrderByNodeWeightDesc(graph.getGraphSeq());

        List<AnalyzeCoMentionEdge> edges = analyzeCoMentionEdgeRepository
                .findByGraphSeqOrderByEdgeWeightDesc(graph.getGraphSeq());

        List<NodeItem> nodeItems = nodes.stream()
                .map(n -> new NodeItem(
                        n.getNodeSeq(),
                        n.getEntityName(),
                        toDouble(n.getNodeWeight())
                ))
                .toList();

        List<EdgeItem> edgeItems = edges.stream()
                .map(e -> new EdgeItem(
                        e.getFromNodeSeq(),
                        e.getToNodeSeq(),
                        toDouble(e.getEdgeWeight())
                ))
                .toList();

        return new CoocNetworkResult(nodeItems, edgeItems);
    }

    /**
     * GET /api/analytics/media-compare/keywords/top/?period=D7|D14&limit=10
     */
    public MediaCompareTopKeywordsResult getMediaCompareTopKeywords(String period, Integer limit) {
        PeriodFilter pf = parsePeriodFilter(period);
        int resolvedLimit = normalizePositive(limit, DEFAULT_LIMIT, 1, 50);

        TrendRunRef latestRun = getConfiguredTrendRunOrThrow();
        PeriodRange fallbackRange = toPeriodRange(latestRun.getBaseDate(), pf);

        // 상단 pill 노출 기준은 항상 D7 분석 가능 여부로 고정한다.
        // 즉, 최근 14일 기사 수가 10건 이상이더라도 최근 7일 기사 수가 10건 미만이면
        // 언론사 비교 페이지 상단 pill 후보에서 제외한다.
        List<TrendKeywordFinalRank> d7Ranks =
                trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(
                        latestRun.getTrendRunSeq(), PeriodFilter.D7
                );

        Map<Long, Integer> d7ArticleCountMap = d7Ranks.stream()
                .collect(Collectors.toMap(
                        TrendKeywordFinalRank::getKeywordSeq,
                        r -> r.getArticleCount() == null ? 0 : r.getArticleCount(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<TrendKeywordFinalRank> periodRanks =
                trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(
                        latestRun.getTrendRunSeq(), pf
                );

        Map<Long, Integer> periodArticleCountMap = periodRanks.stream()
                .collect(Collectors.toMap(
                        TrendKeywordFinalRank::getKeywordSeq,
                        r -> r.getArticleCount() == null ? 0 : r.getArticleCount(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<TrendKeywordFinalRank> d7VisibleTop = d7Ranks.stream()
                .filter(r -> d7ArticleCountMap.getOrDefault(r.getKeywordSeq(), 0) >= ANALYZABLE_MIN_ARTICLE_COUNT)
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

        Map<Long, String> keywordNameMap = loadKeywordNameMap(
                top.stream().map(TrendKeywordFinalRank::getKeywordSeq).toList()
        );

        List<KeywordPillItem> items = top.stream()
                .map(r -> new KeywordPillItem(
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
                    ALL_MEDIA_CODE
            );
            selectedMediaCount = (int) c;
        }

        PeriodRange displayRange = selectedKeywordSeq == null
                ? fallbackRange
                : resolveActualPublishedRangeOrFallback(
                        latestRun.getTrendRunSeq(),
                        selectedKeywordSeq,
                        pf,
                        latestRun.getBaseDate()
                );

        return new MediaCompareTopKeywordsResult(
                displayRange.start().toString(),
                displayRange.end().toString(),
                selectedKeyword,
                selectedArticleCount,
                selectedMediaCount,
                selectedKeywordSeq,
                items
        );
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/media-article-counts/?period=D7|D14
     */
    public MediaArticleCountsResult getMediaArticleCounts(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeMediaStat all = analyzeMediaStatRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(selectedRunSeq, keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("언론사별 기사 수 데이터가 없습니다."));

        List<AnalyzeMediaStat> rows = analyzeMediaStatRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        all.getTrendRunSeq(),
                        keywordSeq,
                        pf,
                        ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = loadMediaNameMap(
                rows.stream().map(AnalyzeMediaStat::getMediaCode).distinct().toList()
        );

        List<MediaArticleCountItem> items = rows.stream()
                .map(r -> new MediaArticleCountItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        r.getArticleCount() == null ? 0 : r.getArticleCount()
                ))
                .toList();

        return new MediaArticleCountsResult(items);
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/sentiment/content/?period=D7|D14
     */
    public MediaSentimentCompareResult getMediaCompareContentSentiment(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment all = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilter(selectedRunSeq, keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("감성 분석 데이터가 없습니다."));

        List<AnalyzeSentiment> rows = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        all.getTrendRunSeq(),
                        keywordSeq,
                        pf,
                        ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = loadMediaNameMap(
                rows.stream().map(AnalyzeSentiment::getMediaCode).distinct().toList()
        );

        List<MediaSentimentItem> items = rows.stream()
                .map(r -> new MediaSentimentItem(
                        mediaNameMap.getOrDefault(r.getMediaCode(), "unknown"),
                        toDouble(r.getPositivePctContent()),
                        toDouble(r.getNeutralPctContent()),
                        toDouble(r.getNegativePctContent())
                ))
                .toList();

        return new MediaSentimentCompareResult(items);
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words/?period=D7|D14&top_n=5
     */
    public MediaTopWordsResult getMediaCompareTitleTopWords(Long keywordSeq, String period, Integer topN) {
        PeriodFilter pf = parsePeriodFilter(period);
        int resolvedTopN = normalizePositive(topN, DEFAULT_TOP_N, 1, 30);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        List<AnalyzeWordcloud> headers = analyzeWordcloudRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndWcTypeAndMediaCodeNotOrderByMediaCodeAsc(
                        selectedRunSeq,
                        keywordSeq,
                        pf,
                        WordcloudType.TITLE,
                        ALL_MEDIA_CODE
                );

        Map<Integer, String> mediaNameMap = loadMediaNameMap(
                headers.stream().map(AnalyzeWordcloud::getMediaCode).distinct().toList()
        );

        List<MediaTopWordsItem> items = new ArrayList<>();

        for (AnalyzeWordcloud h : headers) {
            List<AnalyzeWordcloudItem> topItems = analyzeWordcloudItemRepository
                    .findByWcSeqOrderByRankNoAsc(h.getWcSeq(), PageRequest.of(0, resolvedTopN));

            List<String> words = topItems.stream()
                    .map(AnalyzeWordcloudItem::getWordText)
                    .filter(Objects::nonNull)
                    .toList();

            items.add(new MediaTopWordsItem(
                    mediaNameMap.getOrDefault(h.getMediaCode(), "(unknown)"),
                    words
            ));
        }

        items.sort(Comparator.comparing(MediaTopWordsItem::mediaName));

        return new MediaTopWordsResult(items);
    }

    /* ----------------------------- 내부 공통 로직 ----------------------------- */

    private WordcloudResult getWordcloud(Long keywordSeq, String period, WordcloudType wcType) {
        PeriodFilter pf = parsePeriodFilter(period);

        Long selectedRunSeq = getConfiguredTrendRunSeq();

        requireAnalyzable(selectedRunSeq, keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeWordcloud wc = analyzeWordcloudRepository
                .findByTrendRunSeqAndKeywordSeqAndMediaCodeAndPeriodFilterAndWcType(
                        selectedRunSeq,
                        keywordSeq,
                        ALL_MEDIA_CODE,
                        pf,
                        wcType
                )
                .orElseThrow(() -> new NotFoundException("워드클라우드 데이터가 없습니다."));

        List<AnalyzeWordcloudItem> items = analyzeWordcloudItemRepository
                .findByWcSeqOrderByRankNoAsc(wc.getWcSeq());

        List<WordItem> wordItems = items.stream()
                .map(i -> new WordItem(
                        i.getWordText(),
                        toDouble(i.getWeight())
                ))
                .toList();

        return new WordcloudResult(wordItems);
    }

    private Long getConfiguredTrendRunSeq() {
        return getConfiguredTrendRunOrThrow().getTrendRunSeq();
    }

    private TrendRunRef getConfiguredTrendRunOrThrow() {
        List<TrendRunRef> candidates = trendRunRefRepository.findAll(Sort.by(Sort.Direction.DESC, "trendRunSeq"));
        if (candidates.isEmpty()) {
            throw new NotFoundException("최신 트렌드 run이 없습니다.");
        }

        // If the configured offset is larger than the retained history, keep showing the oldest available run.
        int offset = Math.max(0, analyticsTrendRunOffset);
        int targetIndex = Math.min(offset, candidates.size() - 1);
        return candidates.get(targetIndex);
    }

    private String formatStartedAt(Long trendRunSeq, LocalDateTime fallbackRunAt) {
        if (trendRunSeq != null) {
            Optional<String> runAtText = trendRunRefRepository.findRunAtKstTextByTrendRunSeq(trendRunSeq);
            if (runAtText.isPresent() && !runAtText.get().isBlank()) {
                return runAtText.get();
            }
        }

        return fallbackRunAt == null ? null : fallbackRunAt.format(KST_RUN_AT_FORMATTER);
    }

    private TrendRunRef findComparableTrendRunWithData(LocalDate baseDate, PeriodFilter pf) {
        List<TrendRunRef> candidates = em.createQuery(
                        "select tr from TrendRunRef tr where tr.baseDate = :baseDate order by tr.trendRunSeq desc",
                        TrendRunRef.class
                )
                .setParameter("baseDate", baseDate)
                .getResultList();

        for (TrendRunRef candidate : candidates) {
            long articleCountSum = sumAllKeywordArticleCount(candidate.getTrendRunSeq(), pf);
            if (articleCountSum > 0L) {
                return candidate;
            }
        }

        return null;
    }

    private long sumAllKeywordArticleCount(Long trendRunSeq, PeriodFilter pf) {
        return trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(trendRunSeq, pf)
                .stream()
                .mapToLong(r -> r.getArticleCount() == null ? 0L : r.getArticleCount())
                .sum();
    }

    private TrendKeywordMasterRef getKeywordOrThrow(Long keywordSeq) {
        return trendKeywordMasterRefRepository.findById(keywordSeq)
                .orElseThrow(() -> new NotFoundException("키워드를 찾을 수 없습니다."));
    }

    private Optional<Integer> getFinalRankArticleCountForRun(Long trendRunSeq, Long keywordSeq, PeriodFilter pf) {
        return trendKeywordFinalRankRepository.findByTrendRunSeqAndKeywordSeqAndPeriodFilter(trendRunSeq, keywordSeq, pf)
                .map(TrendKeywordFinalRank::getArticleCount);
    }

    private boolean isAnalyzable(Long trendRunSeq, Long keywordSeq) {
        int count = getFinalRankArticleCountForRun(trendRunSeq, keywordSeq, PeriodFilter.D7).orElse(0);
        return count >= ANALYZABLE_MIN_ARTICLE_COUNT;
    }

    private void requireAnalyzable(Long trendRunSeq, Long keywordSeq) {
        if (!isAnalyzable(trendRunSeq, keywordSeq)) {
            throw new ConflictException("분석 가능한 기사 수가 부족합니다.");
        }
    }

    private Map<Long, String> loadKeywordNameMap(List<Long> keywordSeqs) {
        if (keywordSeqs == null || keywordSeqs.isEmpty()) {
            return Map.of();
        }

        List<TrendKeywordMasterRef> keywords = trendKeywordMasterRefRepository.findAllById(keywordSeqs);

        Map<Long, String> map = new HashMap<>();
        for (TrendKeywordMasterRef k : keywords) {
            map.put(k.getKeywordSeq(), k.getKeywordName());
        }
        return map;
    }

    private Map<Integer, String> loadMediaNameMap(List<Integer> mediaCodes) {
        if (mediaCodes == null || mediaCodes.isEmpty()) {
            return Map.of();
        }

        List<NewsMediaRef> medias = newsMediaRefRepository.findAllById(mediaCodes);

        Map<Integer, String> map = new HashMap<>();
        for (NewsMediaRef m : medias) {
            map.put(m.getMediaCode(), m.getMediaName());
        }
        return map;
    }

    private PeriodFilter parsePeriodFilter(String period) {
        if (period == null || period.isBlank()) {
            return PeriodFilter.D7;
        }

        String p = period.trim().toUpperCase();
        EnumSet<PeriodFilter> allowed = EnumSet.of(PeriodFilter.D7, PeriodFilter.D14);

        try {
            PeriodFilter pf = PeriodFilter.valueOf(p);
            if (!allowed.contains(pf)) {
                throw new IllegalArgumentException("period는 D7 또는 D14만 허용합니다.");
            }
            return pf;
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("period는 D7 또는 D14만 허용합니다.");
        }
    }

    private PeriodRange toPeriodRange(LocalDate baseDate, PeriodFilter pf) {
        if (baseDate == null) {
            throw new IllegalStateException("baseDate가 비어 있습니다.");
        }

        return switch (pf) {
            case D7 -> new PeriodRange(baseDate.minusDays(6), baseDate);
            case D14 -> new PeriodRange(baseDate.minusDays(13), baseDate);
            default -> throw new IllegalArgumentException("period는 D7 또는 D14만 허용합니다.");
        };
    }

    private int normalizePositive(Integer value, int defaultValue, int min, int max) {
        int v = (value == null) ? defaultValue : value;
        if (v < min) v = min;
        if (v > max) v = max;
        return v;
    }

    private double toDouble(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private int levelCode(User user) {
        if (user == null || user.getUserLevel() == null || user.getUserLevel().getGradeCode() == null) return 0;
        return user.getUserLevel().getGradeCode().intValue();
    }

    private long countUsersJoinedBetween(LocalDateTime startInclusive, LocalDateTime endExclusive) {
        Long cnt = em.createQuery(
                        "select count(u) from User u where u.joinedAt >= :start and u.joinedAt < :end",
                        Long.class
                )
                .setParameter("start", startInclusive)
                .setParameter("end", endExclusive)
                .getSingleResult();

        return cnt == null ? 0L : cnt;
    }

    private long countProcessingInquiries() {
        Long cnt = em.createQuery(
                        "select count(i) from Inquiry i where i.isProcessed = false",
                        Long.class
                )
                .getSingleResult();

        return cnt == null ? 0L : cnt;
    }

    private Double calcProcessingInquiryAvgElapsedDays() {
        List<LocalDateTime> submittedAts = em.createQuery(
                        "select i.submittedAt from Inquiry i where i.isProcessed = false",
                        LocalDateTime.class
                )
                .getResultList();

        if (submittedAts == null || submittedAts.isEmpty()) return null;

        LocalDateTime now = LocalDateTime.now(clock);
        double avgDays = submittedAts.stream()
                .mapToDouble(at -> Duration.between(at, now).toMinutes() / 1440.0)
                .average()
                .orElse(0.0);

        return round1(avgDays);
    }

    private Double calcDeltaRateVsAvg(long todayValue, long pastTotal, int days) {
        if (days <= 0) return null;
        double avg = pastTotal / (double) days;
        return calcDeltaRate(todayValue, avg);
    }

    private Double calcDeltaRate(double current, double base) {
        if (base <= 0.0) return null;
        return round1(((current - base) / base) * 100.0);
    }

    private Double calcDeltaRate(long current, long base) {
        if (base <= 0L) return null;
        return round1(((current - (double) base) / (double) base) * 100.0);
    }


    private PeriodRange resolveActualPublishedRangeOrFallback(
            Long trendRunSeq,
            Long keywordSeq,
            PeriodFilter pf,
            LocalDate baseDate
    ) {
        PeriodRange fallback = toPeriodRange(baseDate, pf);

        if (trendRunSeq == null || keywordSeq == null) {
            return fallback;
        }

        return findActualPublishedDateRange(trendRunSeq, keywordSeq, fallback.start(), fallback.end())
                .orElse(fallback);
    }

    /**
     * 실제 기사 발행일 범위(MIN/MAX)를 조회한다.
     * - 스키마/컬럼명이 프로젝트마다 다를 수 있어 대표 후보들을 순차 시도한다.
     * - 조회 실패 시 Optional.empty()를 반환하고 상위에서 기존 기간(D7/D14 계산값)으로 fallback 한다.
     */
    private Optional<PeriodRange> findActualPublishedDateRange(
            Long trendRunSeq,
            Long keywordSeq,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
        List<ArticleDateRangeSqlCandidate> candidates = List.of(
                // 현재 운영 스키마 기준:
                // - 기사 테이블: T_NEWS_ARTICLE
                // - 발행일 컬럼: PUBLISHED_AT
                // - 키워드/런 연결 컬럼: KEYWORD_SEQ, TREND_RUN_SEQ
                //
                // 과거 로컬/구버전 스키마 후보(T_NEWS_ARTICLE_RAW, PUBLISHED_DATE)를 계속 시도하면
                // 운영 DB에서 불필요한 SQL 예외가 발생하고 트랜잭션이 rollback-only로 표시될 수 있다.
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_AT", "KEYWORD_SEQ", "TREND_RUN_SEQ"),

                // run_seq 컬럼이 없는 스키마에도 대비한 fallback
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_AT", "KEYWORD_SEQ", null)
        );

        for (ArticleDateRangeSqlCandidate c : candidates) {
            Optional<PeriodRange> found = tryFetchActualPublishedDateRange(c, trendRunSeq, keywordSeq, windowStart, windowEnd);
            if (found.isPresent()) {
                return found;
            }
        }

        return Optional.empty();
    }

    private Optional<PeriodRange> tryFetchActualPublishedDateRange(
            ArticleDateRangeSqlCandidate c,
            Long trendRunSeq,
            Long keywordSeq,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
        String sql;
        if (c.trendRunSeqCol() == null) {
            sql = String.format(
                    "SELECT DATE(MIN(a.%1$s)) AS min_dt, DATE(MAX(a.%1$s)) AS max_dt " +
                            "FROM %2$s a " +
                            "WHERE a.%3$s = :keywordSeq " +
                            "AND DATE(a.%1$s) BETWEEN :startDate AND :endDate",
                    c.publishedAtCol(),
                    c.tableName(),
                    c.keywordSeqCol()
            );
        } else {
            sql = String.format(
                    "SELECT DATE(MIN(a.%1$s)) AS min_dt, DATE(MAX(a.%1$s)) AS max_dt " +
                            "FROM %2$s a " +
                            "WHERE a.%3$s = :trendRunSeq " +
                            "AND a.%4$s = :keywordSeq " +
                            "AND DATE(a.%1$s) BETWEEN :startDate AND :endDate",
                    c.publishedAtCol(),
                    c.tableName(),
                    c.trendRunSeqCol(),
                    c.keywordSeqCol()
            );
        }

        try {
            var query = em.createNativeQuery(sql);
            query.setParameter("keywordSeq", keywordSeq);
            query.setParameter("startDate", java.sql.Date.valueOf(windowStart));
            query.setParameter("endDate", java.sql.Date.valueOf(windowEnd));

            if (c.trendRunSeqCol() != null) {
                query.setParameter("trendRunSeq", trendRunSeq);
            }

            Object rowObj = query.getSingleResult();
            if (!(rowObj instanceof Object[] row) || row.length < 2) {
                return Optional.empty();
            }

            LocalDate minDate = toLocalDate(row[0]);
            LocalDate maxDate = toLocalDate(row[1]);

            if (minDate == null || maxDate == null) {
                return Optional.empty();
            }

            if (minDate.isAfter(maxDate)) {
                LocalDate tmp = minDate;
                minDate = maxDate;
                maxDate = tmp;
            }

            return Optional.of(new PeriodRange(minDate, maxDate));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate d) return d;
        if (value instanceof LocalDateTime dt) return dt.toLocalDate();
        if (value instanceof java.sql.Date d) return d.toLocalDate();
        if (value instanceof java.sql.Timestamp ts) return ts.toLocalDateTime().toLocalDate();
        if (value instanceof java.util.Date d) {
            return d.toInstant().atZone(clock.getZone()).toLocalDate();
        }

        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        if (text.length() >= 10) {
            text = text.substring(0, 10);
        }

        try {
            return LocalDate.parse(text);
        } catch (Exception ex) {
            return null;
        }
    }

    private Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /* ----------------------------- Service 내부 응답 모델 ----------------------------- */

    public record AdminDashboardSummaryResult(
            long todayJoinedCount,
            Double todayJoinedDeltaRate,
            long todayCollectedArticleCount,
            Double todayCollectedArticleDeltaRate,
            long processingInquiryCount,
            Double processingInquiryAvgElapsedDays
    ) {}

    public record OverviewResult(
            long collectedArticleCount,
            String dataBaseDate,
            String dataStartedAt,
            List<TopKeywordItem> topKeywords
    ) {}

    public record TopKeywordItem(
            int rankNo,
            Long keywordSeq,
            String keyword,
            int articleCount,
            boolean isAnalyzable
    ) {}

    public record KeywordMetaResult(
            long keywordSeq,
            String keyword,
            String periodStart,
            String periodEnd,
            int articleCount,
            int mediaCount,
            boolean isAnalyzable
    ) {}

    public record SummaryResult(
            String summaryText
    ) {}

    public record WordcloudResult(
            List<WordItem> items
    ) {}

    public record WordItem(
            String word,
            double weight
    ) {}

    public record SearchTimelineResult(
            String periodStart,
            String periodEnd,
            Integer latestScore,
            Integer peakScore,
            Double averageScore,
            boolean hasPartial,
            List<SearchTimelinePoint> items
    ) {}

    public record SearchTimelinePoint(
            String observedDate,
            int interestScore,
            boolean isPartial
    ) {}

    public record SentimentResult(
            double positive,
            double neutral,
            double negative
    ) {}

    public record BiasByMediaResult(
            List<BiasByMediaItem> items
    ) {}

    public record BiasByMediaItem(
            String mediaName,
            double biasScore
    ) {}

    public record CoocNetworkResult(
            List<NodeItem> nodes,
            List<EdgeItem> edges
    ) {}

    public record NodeItem(
            long id,
            String label,
            double size
    ) {}

    public record EdgeItem(
            long source,
            long target,
            double weight
    ) {}

    public record MediaCompareTopKeywordsResult(
            String periodStart,
            String periodEnd,
            String selectedKeyword,
            Integer selectedArticleCount,
            Integer selectedMediaCount,
            Long selectedKeywordSeq,
            List<KeywordPillItem> items
    ) {}

    public record KeywordPillItem(
            long keywordSeq,
            String keyword
    ) {}

    public record MediaArticleCountsResult(
            List<MediaArticleCountItem> items
    ) {}

    public record MediaArticleCountItem(
            String mediaName,
            int articleCount
    ) {}

    public record MediaSentimentCompareResult(
            List<MediaSentimentItem> items
    ) {}

    public record MediaSentimentItem(
            String mediaName,
            double positive,
            double neutral,
            double negative
    ) {}

    public record MediaTopWordsResult(
            List<MediaTopWordsItem> items
    ) {}

    public record MediaTopWordsItem(
            String mediaName,
            List<String> words
    ) {}

    private record ArticleDateRangeSqlCandidate(
            String tableName,
            String publishedAtCol,
            String keywordSeqCol,
            String trendRunSeqCol
    ) {}

    private record PeriodRange(LocalDate start, LocalDate end) {}
}
