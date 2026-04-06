// backend/src/main/java/com/newsight/backend/analytics/presentation/AnalyticsController.java
package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.AiSummaryDto;
import com.newsight.backend.analytics.presentation.dto.AnalyticsOverviewDto;
import com.newsight.backend.analytics.presentation.dto.CoocNetworkDto;
import com.newsight.backend.analytics.presentation.dto.ContentSentimentDto;
import com.newsight.backend.analytics.presentation.dto.SearchTimelineDto;
import com.newsight.backend.analytics.presentation.dto.KeywordMetaDto;
import com.newsight.backend.analytics.presentation.dto.MediaArticleCountsDto;
import com.newsight.backend.analytics.presentation.dto.MediaCompareTopKeywordsDto;
import com.newsight.backend.analytics.presentation.dto.MediaContentSentimentCompareDto;
import com.newsight.backend.analytics.presentation.dto.MediaTitleTopWordsDto;
import com.newsight.backend.analytics.presentation.dto.TitleBiasByMediaDto;
import com.newsight.backend.analytics.presentation.dto.WordcloudDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.newsight.backend.analytics.presentation.dto.AdminDashboardSummaryDto;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * GET /api/analytics/overview (또는 /api/analytics/overview/)
     */
    @GetMapping({"/overview", "/overview/"})
    public ResponseEntity<AnalyticsOverviewDto.AnalyticsOverviewResponseDto> getOverview() {
        AnalyticsService.OverviewResult result = analyticsService.getOverview();

        List<AnalyticsOverviewDto.TopKeywordItemDto> items = result.topKeywords().stream()
                .map(i -> new AnalyticsOverviewDto.TopKeywordItemDto(
                        i.rankNo(),
                        i.keywordSeq(),
                        i.keyword(),
                        i.articleCount(),
                        i.isAnalyzable()
                ))
                .toList();

        return ResponseEntity.ok(new AnalyticsOverviewDto.AnalyticsOverviewResponseDto(
                result.collectedArticleCount(),
                result.dataBaseDate(),
                result.dataStartedAt(),
                items
        ));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}", "/keywords/{keyword_seq}/"})
    public ResponseEntity<KeywordMetaDto.KeywordMetaResponseDto> getKeywordMeta(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.KeywordMetaResult result = analyticsService.getKeywordMeta(keywordSeq, period);

        return ResponseEntity.ok(new KeywordMetaDto.KeywordMetaResponseDto(
                result.keywordSeq(),
                result.keyword(),
                result.periodStart(),
                result.periodEnd(),
                result.articleCount(),
                result.mediaCount(),
                result.isAnalyzable()
        ));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/summary?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/summary/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/summary", "/keywords/{keyword_seq}/summary/"})
    public ResponseEntity<AiSummaryDto.AiSummaryResponseDto> getAiSummary(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.SummaryResult result = analyticsService.getAiSummary(keywordSeq, period);

        return ResponseEntity.ok(new AiSummaryDto.AiSummaryResponseDto(
                result.summaryText()
        ));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/title?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/title/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/wordcloud/title", "/keywords/{keyword_seq}/wordcloud/title/"})
    public ResponseEntity<WordcloudDto.WordcloudResponseDto> getTitleWordcloud(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.WordcloudResult result = analyticsService.getTitleWordcloud(keywordSeq, period);

        List<WordcloudDto.WordItemDto> items = result.items().stream()
                .map(i -> new WordcloudDto.WordItemDto(i.word(), i.weight()))
                .toList();

        return ResponseEntity.ok(new WordcloudDto.WordcloudResponseDto(items));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/comment?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/wordcloud/comment/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/wordcloud/comment", "/keywords/{keyword_seq}/wordcloud/comment/"})
    public ResponseEntity<WordcloudDto.WordcloudResponseDto> getCommentWordcloud(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.WordcloudResult result = analyticsService.getCommentWordcloud(keywordSeq, period);

        List<WordcloudDto.WordItemDto> items = result.items().stream()
                .map(i -> new WordcloudDto.WordItemDto(i.word(), i.weight()))
                .toList();

        return ResponseEntity.ok(new WordcloudDto.WordcloudResponseDto(items));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/search-timeline
     * GET /api/analytics/keywords/{keyword_seq}/search-timeline/
     * - period 파라미터가 들어와도 최근 3개월 타임라인을 고정으로 반환한다.
     */
    @GetMapping({
            "/keywords/{keyword_seq}/search-timeline",
            "/keywords/{keyword_seq}/search-timeline/"
    })
    public ResponseEntity<SearchTimelineDto.SearchTimelineResponseDto> getSearchTimeline(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.SearchTimelineResult result = analyticsService.getSearchTimeline(keywordSeq, period);

        List<SearchTimelineDto.TimelinePointDto> items = result.items().stream()
                .map(i -> new SearchTimelineDto.TimelinePointDto(
                        i.observedDate(),
                        i.interestScore(),
                        i.isPartial()
                ))
                .toList();

        return ResponseEntity.ok(new SearchTimelineDto.SearchTimelineResponseDto(
                result.periodStart(),
                result.periodEnd(),
                result.latestScore(),
                result.peakScore(),
                result.averageScore(),
                result.hasPartial(),
                items
        ));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/sentiment/content?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/sentiment/content/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/sentiment/content", "/keywords/{keyword_seq}/sentiment/content/"})
    public ResponseEntity<ContentSentimentDto.ContentSentimentResponseDto> getContentSentiment(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.SentimentResult result = analyticsService.getContentSentiment(keywordSeq, period);

        return ResponseEntity.ok(new ContentSentimentDto.ContentSentimentResponseDto(
                result.positive(),
                result.neutral(),
                result.negative()
        ));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/bias/title?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/bias/title/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/bias/title", "/keywords/{keyword_seq}/bias/title/"})
    public ResponseEntity<TitleBiasByMediaDto.TitleBiasByMediaResponseDto> getTitleBiasByMedia(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.BiasByMediaResult result = analyticsService.getTitleBiasByMedia(keywordSeq, period);

        List<TitleBiasByMediaDto.BiasByMediaItemDto> items = result.items().stream()
                .map(i -> new TitleBiasByMediaDto.BiasByMediaItemDto(i.mediaName(), i.biasScore()))
                .toList();

        return ResponseEntity.ok(new TitleBiasByMediaDto.TitleBiasByMediaResponseDto(items));
    }

    /**
     * GET /api/analytics/keywords/{keyword_seq}/cooc-network?period=D7|D14
     * GET /api/analytics/keywords/{keyword_seq}/cooc-network/?period=D7|D14
     */
    @GetMapping({"/keywords/{keyword_seq}/cooc-network", "/keywords/{keyword_seq}/cooc-network/"})
    public ResponseEntity<CoocNetworkDto.CoocNetworkResponseDto> getCoocNetwork(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.CoocNetworkResult result = analyticsService.getCoocNetwork(keywordSeq, period);

        List<CoocNetworkDto.NodeItemDto> nodes = result.nodes().stream()
                .map(n -> new CoocNetworkDto.NodeItemDto(n.id(), n.label(), n.size()))
                .toList();

        List<CoocNetworkDto.EdgeItemDto> edges = result.edges().stream()
                .map(e -> new CoocNetworkDto.EdgeItemDto(e.source(), e.target(), e.weight()))
                .toList();

        return ResponseEntity.ok(new CoocNetworkDto.CoocNetworkResponseDto(nodes, edges));
    }

    /**
     * GET /api/analytics/media-compare/keywords/top?period=D7|D14&limit=10
     * GET /api/analytics/media-compare/keywords/top/?period=D7|D14&limit=10
     */
    @GetMapping({"/media-compare/keywords/top", "/media-compare/keywords/top/"})
    public ResponseEntity<MediaCompareTopKeywordsDto.MediaCompareTopKeywordsResponseDto> getMediaCompareTopKeywords(
            @RequestParam(value = "period", required = false) String period,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        AnalyticsService.MediaCompareTopKeywordsResult result = analyticsService.getMediaCompareTopKeywords(period, limit);

        List<MediaCompareTopKeywordsDto.KeywordPillItemDto> items = result.items().stream()
                .map(i -> new MediaCompareTopKeywordsDto.KeywordPillItemDto(i.keywordSeq(), i.keyword()))
                .toList();

        return ResponseEntity.ok(new MediaCompareTopKeywordsDto.MediaCompareTopKeywordsResponseDto(
                result.periodStart(),
                result.periodEnd(),
                result.selectedKeyword(),
                result.selectedArticleCount(),
                result.selectedMediaCount(),
                items,
                result.selectedKeywordSeq()
        ));
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/media-article-counts?period=D7|D14
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/media-article-counts/?period=D7|D14
     */
    @GetMapping({
            "/media-compare/keywords/{keyword_seq}/media-article-counts",
            "/media-compare/keywords/{keyword_seq}/media-article-counts/"
    })
    public ResponseEntity<MediaArticleCountsDto.MediaArticleCountsResponseDto> getMediaArticleCounts(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.MediaArticleCountsResult result = analyticsService.getMediaArticleCounts(keywordSeq, period);

        List<MediaArticleCountsDto.MediaArticleCountItemDto> items = result.items().stream()
                .map(i -> new MediaArticleCountsDto.MediaArticleCountItemDto(i.mediaName(), i.articleCount()))
                .toList();

        return ResponseEntity.ok(new MediaArticleCountsDto.MediaArticleCountsResponseDto(items));
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/sentiment/content?period=D7|D14
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/sentiment/content/?period=D7|D14
     */
    @GetMapping({
            "/media-compare/keywords/{keyword_seq}/sentiment/content",
            "/media-compare/keywords/{keyword_seq}/sentiment/content/"
    })
    public ResponseEntity<MediaContentSentimentCompareDto.MediaContentSentimentCompareResponseDto> getMediaCompareContentSentiment(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.MediaSentimentCompareResult result = analyticsService.getMediaCompareContentSentiment(keywordSeq, period);

        List<MediaContentSentimentCompareDto.MediaSentimentItemDto> items = result.items().stream()
                .map(i -> new MediaContentSentimentCompareDto.MediaSentimentItemDto(
                        i.mediaName(),
                        i.positive(),
                        i.neutral(),
                        i.negative()
                ))
                .toList();

        return ResponseEntity.ok(new MediaContentSentimentCompareDto.MediaContentSentimentCompareResponseDto(items));
    }

    /**
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words?period=D7|D14&top_n=5
     * GET /api/analytics/media-compare/keywords/{keyword_seq}/framing/title-top-words/?period=D7|D14&top_n=5
     */
    @GetMapping({
            "/media-compare/keywords/{keyword_seq}/framing/title-top-words",
            "/media-compare/keywords/{keyword_seq}/framing/title-top-words/"
    })
    public ResponseEntity<MediaTitleTopWordsDto.MediaTitleTopWordsResponseDto> getMediaCompareTitleTopWords(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period,
            @RequestParam(value = "top_n", required = false) Integer topN
    ) {
        AnalyticsService.MediaTopWordsResult result = analyticsService.getMediaCompareTitleTopWords(keywordSeq, period, topN);

        List<MediaTitleTopWordsDto.MediaTopWordsItemDto> items = result.items().stream()
                .map(i -> new MediaTitleTopWordsDto.MediaTopWordsItemDto(i.mediaName(), i.words()))
                .toList();

        return ResponseEntity.ok(new MediaTitleTopWordsDto.MediaTitleTopWordsResponseDto(items));
    }
}

@RestController
@RequestMapping("/api/admins/dashboard")
@RequiredArgsConstructor
class AdminDashboardController {

    private final AnalyticsService analyticsService;

    /**
     * GET /api/admins/dashboard/summary (또는 /api/admins/dashboard/summary/)
     */
    @GetMapping({"/summary", "/summary/"})
    public ResponseEntity<AdminDashboardSummaryDto.AdminDashboardSummaryResponseDto> getSummary(
            @AuthenticationPrincipal Jwt jwt
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AnalyticsService.AdminDashboardSummaryResult r = analyticsService.getAdminDashboardSummary(actorUserSeq);

        return ResponseEntity.ok(new AdminDashboardSummaryDto.AdminDashboardSummaryResponseDto(
                r.todayJoinedCount(),
                r.todayJoinedDeltaRate(),
                r.todayCollectedArticleCount(),
                r.todayCollectedArticleDeltaRate(),
                r.processingInquiryCount(),
                r.processingInquiryAvgElapsedDays()
        ));
    }

    private Long requireUserSeq(Jwt jwt) {
        if (jwt == null) {
            throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
        }
        Object v = jwt.getClaim("user_seq");
        if (v instanceof Number n) return n.longValue();
        if (v instanceof String s) {
            try {
                return Long.parseLong(s.trim());
            } catch (Exception ignore) {
                // fallthrough
            }
        }
        try {
            String sub = jwt.getSubject();
            if (sub != null && !sub.isBlank()) return Long.parseLong(sub.trim());
        } catch (Exception ignore) {
            // ignore
        }
        throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
    }
}
