package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.AiSummaryDto;
import com.newsight.backend.analytics.presentation.dto.CoocNetworkDto;
import com.newsight.backend.analytics.presentation.dto.ContentSentimentDto;
import com.newsight.backend.analytics.presentation.dto.KeywordMetaDto;
import com.newsight.backend.analytics.presentation.dto.SearchTimelineDto;
import com.newsight.backend.analytics.presentation.dto.TitleBiasByMediaDto;
import com.newsight.backend.analytics.presentation.dto.WordcloudDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Keyword Analytics", description = "Public keyword detail analytics APIs")
public class KeywordAnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/keywords/{keyword_seq}")
    @Operation(summary = "Get keyword metadata")
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

    @GetMapping("/keywords/{keyword_seq}/summary")
    @Operation(summary = "Get AI summary")
    public ResponseEntity<AiSummaryDto.AiSummaryResponseDto> getAiSummary(
            @PathVariable("keyword_seq") Long keywordSeq,
            @RequestParam(value = "period", required = false) String period
    ) {
        AnalyticsService.SummaryResult result = analyticsService.getAiSummary(keywordSeq, period);
        return ResponseEntity.ok(new AiSummaryDto.AiSummaryResponseDto(result.summaryText()));
    }

    @GetMapping("/keywords/{keyword_seq}/wordcloud/title")
    @Operation(summary = "Get title wordcloud")
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

    @GetMapping("/keywords/{keyword_seq}/wordcloud/comment")
    @Operation(summary = "Get comment wordcloud")
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

    @GetMapping("/keywords/{keyword_seq}/search-timeline")
    @Operation(summary = "Get search interest timeline")
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

    @GetMapping("/keywords/{keyword_seq}/sentiment/content")
    @Operation(summary = "Get content sentiment")
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

    @GetMapping("/keywords/{keyword_seq}/bias/title")
    @Operation(summary = "Get title bias by media")
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

    @GetMapping("/keywords/{keyword_seq}/cooc-network")
    @Operation(summary = "Get co-occurrence network")
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
}
