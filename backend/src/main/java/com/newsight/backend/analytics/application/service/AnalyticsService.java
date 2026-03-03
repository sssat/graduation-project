// backend/src/main/java/com/newsight/backend/analytics/application/service/AnalyticsService.java
package com.newsight.backend.analytics.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.analytics.domain.model.AnalyzeAiSummary;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionEdge;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionGraph;
import com.newsight.backend.analytics.domain.model.AnalyzeCoMentionNode;
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
import org.springframework.data.domain.PageRequest;
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

    private final SpringDataTrendRunRefRepository trendRunRefRepository;
    private final SpringDataTrendKeywordMasterRefRepository trendKeywordMasterRefRepository;
    private final SpringDataTrendKeywordFinalRankRepository trendKeywordFinalRankRepository;

    private final SpringDataAnalyzeMediaStatRepository analyzeMediaStatRepository;
    private final SpringDataAnalyzeAiSummaryRepository analyzeAiSummaryRepository;
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

    @PersistenceContext
    private EntityManager em;

    /**
     * GET /api/analytics/overview/
     * - collected_article_count: ALL + D14 기준 전체 기사 수(최종랭크 테이블 합계)
     * - top_keywords: ALL + D7 기준 TOP10
     */
    public OverviewResult getOverview() {
        Long latestRunSeq = getLatestTrendRunSeq();

        long collectedArticleCount = sumAllKeywordArticleCount(latestRunSeq, PeriodFilter.D14);

        List<TrendKeywordFinalRank> topRanks =
                trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(latestRunSeq, PeriodFilter.D7);

        List<TrendKeywordFinalRank> top10 = topRanks.stream()
                .limit(DEFAULT_LIMIT)
                .toList();

        Map<Long, String> keywordNameMap = loadKeywordNameMap(
                top10.stream().map(TrendKeywordFinalRank::getKeywordSeq).toList()
        );

        List<TopKeywordItem> topKeywords = top10.stream()
                .map(r -> new TopKeywordItem(
                        r.getFinalRank(),
                        keywordNameMap.getOrDefault(r.getKeywordSeq(), "(unknown)"),
                        r.getArticleCount(),
                        r.getArticleCount() >= ANALYZABLE_MIN_ARTICLE_COUNT
                ))
                .toList();

        return new OverviewResult(collectedArticleCount, topKeywords);
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
        TrendRunRef latestRun = getLatestTrendRunOrThrow();
        long todayCollectedArticleCount = sumAllKeywordArticleCount(latestRun.getTrendRunSeq(), PeriodFilter.D14);

        TrendRunRef lastWeekRun = trendRunRefRepository
                .findFirstByBaseDateOrderByTrendRunSeqDesc(latestRun.getBaseDate().minusDays(7))
                .orElse(null);

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

        TrendRunRef latestRun = getLatestTrendRunOrThrow();
        PeriodRange range = resolveActualPublishedRangeOrFallback(
                latestRun.getTrendRunSeq(),
                keywordSeq,
                pf,
                latestRun.getBaseDate()
        );

        int articleCount = getFinalRankArticleCountLatest(keywordSeq, pf).orElse(0);
        long mediaCount = analyzeMediaStatRepository.countDistinctMediaCode(
                latestRun.getTrendRunSeq(),
                keywordSeq,
                pf,
                ALL_MEDIA_CODE
        );

        boolean analyzable = isAnalyzable(keywordSeq);

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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        Long latestRunSeq = getLatestTrendRunSeq();

        AnalyzeAiSummary summary = analyzeAiSummaryRepository.findByTrendRunSeqAndKeywordSeq(latestRunSeq, keywordSeq)
                .orElseGet(() -> analyzeAiSummaryRepository.findFirstByKeywordSeqOrderByTrendRunSeqDesc(keywordSeq)
                        .orElseThrow(() -> new NotFoundException("AI 요약 데이터가 없습니다.")));

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
     * GET /api/analytics/keywords/{keyword_seq}/sentiment/content/?period=D7|D14
     */
    public SentimentResult getContentSentiment(Long keywordSeq, String period) {
        PeriodFilter pf = parsePeriodFilter(period);

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment sentiment = analyzeSentimentRepository
                .findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(keywordSeq, ALL_MEDIA_CODE, pf)
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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        Long latestRunSeq = getLatestTrendRunSeq();

        List<AnalyzeMediaBias> rows = analyzeMediaBiasRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        latestRunSeq,
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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeCoMentionGraph graph = analyzeCoMentionGraphRepository
                .findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("공동 언급 네트워크 데이터가 없습니다."));

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

        TrendRunRef latestRun = getLatestTrendRunOrThrow();
        PeriodRange fallbackRange = toPeriodRange(latestRun.getBaseDate(), pf);    

        List<TrendKeywordFinalRank> ranks =
                trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(
                        latestRun.getTrendRunSeq(), pf
                );    

        // 핵심: 10건 미만은 TOP 리스트에서 제외 → 버튼이 애초에 안 보임
        List<TrendKeywordFinalRank> top = ranks.stream()
                .filter(r -> (r.getArticleCount() == null ? 0 : r.getArticleCount()) >= ANALYZABLE_MIN_ARTICLE_COUNT)
                .limit(resolvedLimit)
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
        Integer selectedArticleCount = top.isEmpty() ? null : top.get(0).getArticleCount();    

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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeMediaStat all = analyzeMediaStatRepository
                .findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("언론사별 기사 수 데이터가 없습니다."));

        Long latestRunSeq = all.getTrendRunSeq();

        List<AnalyzeMediaStat> rows = analyzeMediaStatRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        latestRunSeq,
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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeSentiment all = analyzeSentimentRepository
                .findFirstByKeywordSeqAndMediaCodeAndPeriodFilterOrderByTrendRunSeqDesc(keywordSeq, ALL_MEDIA_CODE, pf)
                .orElseThrow(() -> new NotFoundException("감성 분석 데이터가 없습니다."));

        Long latestRunSeq = all.getTrendRunSeq();

        List<AnalyzeSentiment> rows = analyzeSentimentRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndMediaCodeNotOrderByMediaCodeAsc(
                        latestRunSeq,
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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        Long latestRunSeq = getLatestTrendRunSeq();

        List<AnalyzeWordcloud> headers = analyzeWordcloudRepository
                .findByTrendRunSeqAndKeywordSeqAndPeriodFilterAndWcTypeAndMediaCodeNotOrderByMediaCodeAsc(
                        latestRunSeq,
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

        requireAnalyzable(keywordSeq);
        getKeywordOrThrow(keywordSeq);

        AnalyzeWordcloud wc = analyzeWordcloudRepository
                .findFirstByKeywordSeqAndMediaCodeAndPeriodFilterAndWcTypeOrderByTrendRunSeqDesc(
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

    private Long getLatestTrendRunSeq() {
        return getLatestTrendRunOrThrow().getTrendRunSeq();
    }

    private TrendRunRef getLatestTrendRunOrThrow() {
        return trendRunRefRepository.findFirstByOrderByTrendRunSeqDesc()
                .orElseThrow(() -> new NotFoundException("최신 트렌드 run이 없습니다."));
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

    private Optional<Integer> getFinalRankArticleCountLatest(Long keywordSeq, PeriodFilter pf) {
        return trendKeywordFinalRankRepository.findFirstByKeywordSeqAndPeriodFilterOrderByTrendRunSeqDesc(keywordSeq, pf)
                .map(TrendKeywordFinalRank::getArticleCount);
    }

    private boolean isAnalyzable(Long keywordSeq) {
        int count = getFinalRankArticleCountLatest(keywordSeq, PeriodFilter.D7).orElse(0);
        return count >= ANALYZABLE_MIN_ARTICLE_COUNT;
    }

    private void requireAnalyzable(Long keywordSeq) {
        if (!isAnalyzable(keywordSeq)) {
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
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_AT", "KEYWORD_SEQ", "TREND_RUN_SEQ"),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_DATE", "KEYWORD_SEQ", "TREND_RUN_SEQ"),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE_RAW", "PUBLISHED_AT", "KEYWORD_SEQ", "TREND_RUN_SEQ"),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE_RAW", "PUBLISHED_DATE", "KEYWORD_SEQ", "TREND_RUN_SEQ"),

                // run_seq 컬럼이 없는 경우(키워드 + 날짜 범위로만 조회)도 대비
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_AT", "KEYWORD_SEQ", null),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_DATE", "KEYWORD_SEQ", null),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE_RAW", "PUBLISHED_AT", "KEYWORD_SEQ", null),
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE_RAW", "PUBLISHED_DATE", "KEYWORD_SEQ", null)
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
            List<TopKeywordItem> topKeywords
    ) {}

    public record TopKeywordItem(
            int rankNo,
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