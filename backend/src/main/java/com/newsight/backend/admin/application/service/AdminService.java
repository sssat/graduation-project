package com.newsight.backend.admin.application.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminUserService adminUserService;
    private final AdminDashboardAnalyticsService adminDashboardAnalyticsService;
    private final VisitTrackingService visitTrackingService;

    public UserListResult listUsers(UserListQuery query) {
        return adminUserService.listUsers(query);
    }

    public AdminLoginLogListResult listAdminDashboardLoginLogs(AdminLoginLogListQuery query) {
        return adminUserService.listAdminDashboardLoginLogs(query);
    }

    public PromoteResult promoteToAdmin(Long targetUserSeq, Long operatorUserSeq) {
        return adminUserService.promoteToAdmin(targetUserSeq, operatorUserSeq);
    }

    public DemoteResult demoteToUser(Long targetUserSeq, Long operatorUserSeq) {
        return adminUserService.demoteToUser(targetUserSeq, operatorUserSeq);
    }

    public WithdrawResult withdrawUser(Long targetUserSeq, Long operatorUserSeq) {
        return adminUserService.withdrawUser(targetUserSeq, operatorUserSeq);
    }

    public AdminDashboardSummaryResult getAdminDashboardSummary(Long actorUserSeq) {
        return adminDashboardAnalyticsService.getAdminDashboardSummary(actorUserSeq);
    }

    public VisitTrackingService.AdminVisitListResult listAdminDashboardVisits(Long actorUserSeq, int page, int size) {
        return visitTrackingService.listAdminDashboardVisits(actorUserSeq, page, size);
    }

    public record PromoteResult(Long user_seq, Long acted_seq, String admin_level, LocalDateTime granted_at) {}

    public record DemoteResult(Long user_seq, Long acted_seq, LocalDateTime demoted_at) {}

    public record WithdrawResult(Long user_seq, LocalDateTime deleted_at, Long acted_seq) {}

    public record UserListItem(
            Long user_seq,
            String user_id,
            String user_name,
            int grade_code,
            String grade_name,
            String email,
            LocalDate birth_date,
            String gender,
            LocalDateTime last_login_at,
            LocalDateTime joined_at,
            LocalDateTime granted_at,
            LocalDateTime password_changed_at
    ) {}

    public record UserListResult(List<UserListItem> items, int page, int size, long total_count, int total_pages) {}

    public record AdminLoginLogItem(
            Long login_log_seq,
            String input_id,
            LocalDateTime attempted_at,
            Long user_seq,
            boolean is_success,
            String ip_address,
            String user_agent
    ) {}

    public record AdminLoginLogListResult(
            List<AdminLoginLogItem> items,
            int page,
            int size,
            long total_count,
            int total_pages
    ) {}

    public record AdminLoginLogListQuery(Long actorUserSeq, int page, int size) {}

    public record UserListQuery(Long actorUserSeq, int page, int size, String q) {}

    public record AdminDashboardSummaryResult(
            long todayJoinedCount,
            Double todayJoinedDeltaRate,
            long todayVisitorCount,
            Double todayVisitorDeltaRate,
            long todayCollectedArticleCount,
            Double todayCollectedArticleDeltaRate,
            long processingInquiryCount,
            Double processingInquiryAvgElapsedDays
    ) {}
}
