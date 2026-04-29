package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.AdminDashboardSummaryDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admins/dashboard")
@RequiredArgsConstructor
@Tag(name = "Admin Dashboard", description = "Administrator dashboard APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminDashboardController {

    private final AnalyticsService analyticsService;

    @GetMapping({"/summary", "/summary/"})
    @Operation(summary = "Get dashboard summary")
    public ResponseEntity<AdminDashboardSummaryDto.AdminDashboardSummaryResponseDto> getSummary(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);
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
}
