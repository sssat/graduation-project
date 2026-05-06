package com.newsight.backend.analytics.application.service;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final AnalyticsOverviewService overviewService;
    private final KeywordAnalyticsService keywordAnalyticsService;
    private final MediaCompareAnalyticsService mediaCompareAnalyticsService;

    public OverviewResult getOverview() {
        return overviewService.getOverview();
    }

    public KeywordMetaResult getKeywordMeta(Long keywordSeq, String period) {
        return keywordAnalyticsService.getKeywordMeta(keywordSeq, period);
    }

    public SummaryResult getAiSummary(Long keywordSeq, String period) {
        return keywordAnalyticsService.getAiSummary(keywordSeq, period);
    }

    public WordcloudResult getTitleWordcloud(Long keywordSeq, String period) {
        return keywordAnalyticsService.getTitleWordcloud(keywordSeq, period);
    }

    public WordcloudResult getCommentWordcloud(Long keywordSeq, String period) {
        return keywordAnalyticsService.getCommentWordcloud(keywordSeq, period);
    }

    public SearchTimelineResult getSearchTimeline(Long keywordSeq, String period) {
        return keywordAnalyticsService.getSearchTimeline(keywordSeq, period);
    }

    public SentimentResult getContentSentiment(Long keywordSeq, String period) {
        return keywordAnalyticsService.getContentSentiment(keywordSeq, period);
    }

    public BiasByMediaResult getTitleBiasByMedia(Long keywordSeq, String period) {
        return keywordAnalyticsService.getTitleBiasByMedia(keywordSeq, period);
    }

    public CoocNetworkResult getCoocNetwork(Long keywordSeq, String period) {
        return keywordAnalyticsService.getCoocNetwork(keywordSeq, period);
    }

    public MediaCompareTopKeywordsResult getMediaCompareTopKeywords(String period, Integer limit) {
        return mediaCompareAnalyticsService.getMediaCompareTopKeywords(period, limit);
    }

    public MediaArticleCountsResult getMediaArticleCounts(Long keywordSeq, String period) {
        return mediaCompareAnalyticsService.getMediaArticleCounts(keywordSeq, period);
    }

    public MediaSentimentCompareResult getMediaCompareContentSentiment(Long keywordSeq, String period) {
        return mediaCompareAnalyticsService.getMediaCompareContentSentiment(keywordSeq, period);
    }

    public MediaTopWordsResult getMediaCompareTitleTopWords(Long keywordSeq, String period, Integer topN) {
        return mediaCompareAnalyticsService.getMediaCompareTitleTopWords(keywordSeq, period, topN);
    }

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
}
