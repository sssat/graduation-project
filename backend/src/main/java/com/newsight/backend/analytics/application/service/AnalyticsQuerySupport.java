package com.newsight.backend.analytics.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.TrendKeywordFinalRank;
import com.newsight.backend.analytics.domain.model.reference.NewsMediaRef;
import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class AnalyticsQuerySupport {

    static final int ANALYZABLE_MIN_ARTICLE_COUNT = 10;
    static final int DEFAULT_LIMIT = 10;
    static final int DEFAULT_TOP_N = 5;
    static final int ALL_MEDIA_CODE = 0;
    static final String PUBLISHED_RUN_STATUS = "PUBLISHED";
    static final long SEARCH_TIMELINE_LOOKBACK_MONTHS = 3L;
    static final String SEARCH_TIMELINE_DATA_SOURCE = "NAVER_DATALAB";

    private static final DateTimeFormatter KST_RUN_AT_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'+09:00'");

    private final SpringDataTrendRunRefRepository trendRunRefRepository;
    private final SpringDataTrendKeywordMasterRefRepository trendKeywordMasterRefRepository;
    private final SpringDataTrendKeywordFinalRankRepository trendKeywordFinalRankRepository;
    private final SpringDataNewsMediaRefRepository newsMediaRefRepository;
    private final Clock clock;

    @Value("${app.analytics.trend-run-offset:0}")
    private int analyticsTrendRunOffset;

    @PersistenceContext
    private EntityManager em;

    Long getConfiguredTrendRunSeq() {
        return getConfiguredTrendRunOrThrow().getTrendRunSeq();
    }

    TrendRunRef getConfiguredTrendRunOrThrow() {
        List<TrendRunRef> candidates = trendRunRefRepository.findByRunStatusOrderByTrendRunSeqDesc(PUBLISHED_RUN_STATUS);
        if (candidates.isEmpty()) {
            throw new NotFoundException("공개된 트렌드 run이 없습니다.");
        }

        int offset = Math.max(0, analyticsTrendRunOffset);
        int targetIndex = Math.min(offset, candidates.size() - 1);
        return candidates.get(targetIndex);
    }

    String formatStartedAt(Long trendRunSeq, LocalDateTime fallbackRunAt) {
        if (trendRunSeq != null) {
            Optional<String> runAtText = trendRunRefRepository.findRunAtKstTextByTrendRunSeq(trendRunSeq);
            if (runAtText.isPresent() && !runAtText.get().isBlank()) {
                return runAtText.get();
            }
        }

        return fallbackRunAt == null ? null : fallbackRunAt.format(KST_RUN_AT_FORMATTER);
    }

    TrendRunRef findComparableTrendRunWithData(LocalDate baseDate, PeriodFilter pf) {
        List<TrendRunRef> candidates = em.createQuery(
                        "select tr from TrendRunRef tr " +
                                "where tr.baseDate = :baseDate and tr.runStatus = :runStatus " +
                                "order by tr.trendRunSeq desc",
                        TrendRunRef.class
                )
                .setParameter("baseDate", baseDate)
                .setParameter("runStatus", PUBLISHED_RUN_STATUS)
                .getResultList();

        for (TrendRunRef candidate : candidates) {
            long articleCountSum = sumAllKeywordArticleCount(candidate.getTrendRunSeq(), pf);
            if (articleCountSum > 0L) {
                return candidate;
            }
        }

        return null;
    }

    List<TrendKeywordFinalRank> findFinalRanksByRunAndPeriod(Long trendRunSeq, PeriodFilter pf) {
        return trendKeywordFinalRankRepository.findByTrendRunSeqAndPeriodFilterOrderByFinalRankAsc(trendRunSeq, pf);
    }

    long sumAllKeywordArticleCount(Long trendRunSeq, PeriodFilter pf) {
        return findFinalRanksByRunAndPeriod(trendRunSeq, pf)
                .stream()
                .mapToLong(r -> r.getArticleCount() == null ? 0L : r.getArticleCount())
                .sum();
    }

    TrendKeywordMasterRef getKeywordOrThrow(Long keywordSeq) {
        return trendKeywordMasterRefRepository.findById(keywordSeq)
                .orElseThrow(() -> new NotFoundException("키워드를 찾을 수 없습니다."));
    }

    Optional<Integer> getFinalRankArticleCountForRun(Long trendRunSeq, Long keywordSeq, PeriodFilter pf) {
        return trendKeywordFinalRankRepository.findByTrendRunSeqAndKeywordSeqAndPeriodFilter(trendRunSeq, keywordSeq, pf)
                .map(TrendKeywordFinalRank::getArticleCount);
    }

    boolean isAnalyzable(Long trendRunSeq, Long keywordSeq) {
        int count = getFinalRankArticleCountForRun(trendRunSeq, keywordSeq, PeriodFilter.D7).orElse(0);
        return count >= ANALYZABLE_MIN_ARTICLE_COUNT;
    }

    void requireAnalyzable(Long trendRunSeq, Long keywordSeq) {
        if (!isAnalyzable(trendRunSeq, keywordSeq)) {
            throw new ConflictException("분석 가능한 기사 수가 부족합니다.");
        }
    }

    Map<Long, String> loadKeywordNameMap(List<Long> keywordSeqs) {
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

    Map<Integer, String> loadMediaNameMap(List<Integer> mediaCodes) {
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

    PeriodFilter parsePeriodFilter(String period) {
        if (period == null || period.isBlank()) {
            return PeriodFilter.D7;
        }

        String p = period.trim().toUpperCase();
        EnumSet<PeriodFilter> allowed = EnumSet.of(PeriodFilter.D7, PeriodFilter.D14);

        try {
            PeriodFilter pf = PeriodFilter.valueOf(p);
            if (!allowed.contains(pf)) {
                throw new IllegalArgumentException("period는 D7 또는 D14만 사용할 수 있습니다.");
            }
            return pf;
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("period는 D7 또는 D14만 사용할 수 있습니다.");
        }
    }

    PeriodRange toPeriodRange(LocalDate baseDate, PeriodFilter pf) {
        if (baseDate == null) {
            throw new IllegalStateException("baseDate가 비어 있습니다.");
        }

        return switch (pf) {
            case D7 -> new PeriodRange(baseDate.minusDays(6), baseDate);
            case D14 -> new PeriodRange(baseDate.minusDays(13), baseDate);
            default -> throw new IllegalArgumentException("period는 D7 또는 D14만 사용할 수 있습니다.");
        };
    }

    int normalizePositive(Integer value, int defaultValue, int min, int max) {
        int v = (value == null) ? defaultValue : value;
        if (v < min) v = min;
        if (v > max) v = max;
        return v;
    }

    double toDouble(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    int levelCode(User user) {
        if (user == null || user.getUserLevel() == null || user.getUserLevel().getGradeCode() == null) return 0;
        return user.getUserLevel().getGradeCode().intValue();
    }

    Double calcDeltaRateVsAvg(long todayValue, long pastTotal, int days) {
        if (days <= 0) return null;
        double avg = pastTotal / (double) days;
        return calcDeltaRate(todayValue, avg);
    }

    Double calcDeltaRate(double current, double base) {
        if (base <= 0.0) return null;
        return round1(((current - base) / base) * 100.0);
    }

    Double calcDeltaRate(long current, long base) {
        if (base <= 0L) return null;
        return round1(((current - (double) base) / (double) base) * 100.0);
    }

    PeriodRange resolveActualPublishedRangeOrFallback(
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

    Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private Optional<PeriodRange> findActualPublishedDateRange(
            Long trendRunSeq,
            Long keywordSeq,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
        List<ArticleDateRangeSqlCandidate> candidates = List.of(
                new ArticleDateRangeSqlCandidate("T_NEWS_ARTICLE", "PUBLISHED_AT", "KEYWORD_SEQ", "TREND_RUN_SEQ"),
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

    record PeriodRange(LocalDate start, LocalDate end) {}

    private record ArticleDateRangeSqlCandidate(
            String tableName,
            String publishedAtCol,
            String keywordSeqCol,
            String trendRunSeqCol
    ) {}
}
