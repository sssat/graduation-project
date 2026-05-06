package com.newsight.backend.admin.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.analytics.application.service.AnalyticsQuerySupport;
import com.newsight.backend.analytics.domain.model.PeriodFilter;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
class AdminDashboardAnalyticsService {

    private final AnalyticsQuerySupport support;
    private final SpringDataUserRepository userRepository;
    private final EntityManager em;
    private final Clock clock;

    AdminService.AdminDashboardSummaryResult getAdminDashboardSummary(Long actorUserSeq) {
        if (actorUserSeq == null) {
            throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
        }

        User actor = userRepository.findByUserSeq(actorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (AdminSupport.levelCode(actor) < 1) {
            throw new SecurityException("관리자만 접근할 수 있습니다.");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDateTime startOfToday = today.atStartOfDay();
        LocalDateTime endOfToday = startOfToday.plusDays(1);

        long todayJoinedCount = countUsersJoinedBetween(startOfToday, endOfToday);
        long past7JoinedTotal = countUsersJoinedBetween(startOfToday.minusDays(7), startOfToday);
        Double todayJoinedDeltaRate = support.calcDeltaRateVsAvg(todayJoinedCount, past7JoinedTotal, 7);

        long todayVisitorCount = countVisitorsBetween(today, today.plusDays(1));
        long past7VisitorTotal = countVisitorsBetween(today.minusDays(7), today);
        Double todayVisitorDeltaRate = support.calcDeltaRateVsAvg(todayVisitorCount, past7VisitorTotal, 7);

        TrendRunRef selectedRun = support.getConfiguredTrendRunOrThrow();
        long todayCollectedArticleCount = support.sumAllKeywordArticleCount(selectedRun.getTrendRunSeq(), PeriodFilter.D14);

        TrendRunRef lastWeekRun = support.findComparableTrendRunWithData(
                selectedRun.getBaseDate().minusDays(7),
                PeriodFilter.D14
        );

        Double todayCollectedArticleDeltaRate = null;
        if (lastWeekRun != null) {
            long lastWeekCount = support.sumAllKeywordArticleCount(lastWeekRun.getTrendRunSeq(), PeriodFilter.D14);
            todayCollectedArticleDeltaRate = support.calcDeltaRate(todayCollectedArticleCount, lastWeekCount);
        }

        long processingInquiryCount = countProcessingInquiries();
        Double processingInquiryAvgElapsedDays = calcProcessingInquiryAvgElapsedDays();

        return new AdminService.AdminDashboardSummaryResult(
                todayJoinedCount,
                todayJoinedDeltaRate,
                todayVisitorCount,
                todayVisitorDeltaRate,
                todayCollectedArticleCount,
                todayCollectedArticleDeltaRate,
                processingInquiryCount,
                processingInquiryAvgElapsedDays
        );
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

    private long countVisitorsBetween(LocalDate startInclusive, LocalDate endExclusive) {
        Long cnt = em.createQuery(
                        "select count(v) from DailyVisitor v where v.visitDate >= :start and v.visitDate < :end",
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

        return support.round1(avgDays);
    }
}
