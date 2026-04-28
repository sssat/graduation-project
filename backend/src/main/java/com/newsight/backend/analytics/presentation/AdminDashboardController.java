package com.newsight.backend.analytics.presentation;

import com.newsight.backend.analytics.application.service.AnalyticsService;
import com.newsight.backend.analytics.presentation.dto.AdminDashboardSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admins/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AnalyticsService analyticsService;

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
            throw new AuthenticationCredentialsNotFoundException("Login is required.");
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
        throw new AuthenticationCredentialsNotFoundException("Login is required.");
    }
}
