package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.AnalyticsOverviewDto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsOverviewController {

    private final AnalyticsService analyticsService;

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
}
