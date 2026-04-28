package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.MediaArticleCountsDto;
import com.newsight.backend.analytics.presentation.dto.MediaCompareTopKeywordsDto;
import com.newsight.backend.analytics.presentation.dto.MediaContentSentimentCompareDto;
import com.newsight.backend.analytics.presentation.dto.MediaTitleTopWordsDto;
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
public class MediaCompareController {

    private final AnalyticsService analyticsService;

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
