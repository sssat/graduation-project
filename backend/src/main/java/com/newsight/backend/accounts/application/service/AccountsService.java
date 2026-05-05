package com.newsight.backend.accounts.application.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountsService {

    private final AccountRegistrationService registrationService;
    private final AccountAuthService authService;
    private final AccountRecoveryService recoveryService;
    private final AccountPasswordService passwordService;
    private final AdminUserService adminUserService;

    public IdPrecheckResult precheckUserId(String userId) {
        return registrationService.precheckUserId(userId);
    }

    public EmailPrecheckResult precheckEmail(String email) {
        return registrationService.precheckEmail(email);
    }

    public SignUpResult signUp(SignUpCommand cmd) {
        return registrationService.signUp(cmd);
    }

    public LoginIssueResult loginIssue(String userId, String password, String ip, String ua) {
        return authService.loginIssue(userId, password, ip, ua);
    }

    public TokenRefreshIssueResult refreshIssue(String refreshToken) {
        return authService.refreshIssue(refreshToken);
    }

    public LogoutResult logout(String refreshToken) {
        return authService.logout(refreshToken);
    }

    public FindIdResult findUserId(FindIdCommand cmd) {
        return recoveryService.findUserId(cmd);
    }

    public FindPasswordResult findPassword(FindPasswordCommand cmd) {
        return recoveryService.findPassword(cmd);
    }

    public ChangePasswordResult changePassword(ChangePasswordCommand cmd) {
        return passwordService.changePassword(cmd);
    }

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

    public record UserIdInfo(boolean valid, String status) {}
    public record IdPrecheckResult(UserIdInfo user_id, String id_check_token, Integer expires_in) {}

    public record EmailInfo(boolean valid, String status) {}
    public record EmailPrecheckResult(EmailInfo email, String email_check_token, Integer expires_in, String message) {}

    public record SignUpResult(Long user_seq, LocalDateTime joined_at) {}

    public record LoginResponse(String access, String role, Long user_seq, String user_id, String message) {}
    public record LoginIssueResult(LoginResponse response, @JsonIgnore String refreshToken) {}

    public record TokenRefreshResponse(String access) {}
    public record TokenRefreshIssueResult(TokenRefreshResponse response, @JsonIgnore String refreshToken) {}

    public record LogoutResult(String message) {}

    public record FindIdCommand(String email, String name) {}
    public record FindIdResult(String user_id) {}

    public record FindPasswordCommand(String userId, String name, String email) {}
    public record FindPasswordResult(String message) {}

    public record ChangePasswordCommand(Long actorUserSeq, String currentPassword, String newPassword, String newPasswordConfirm) {}
    public record ChangePasswordResult(String message, boolean clearRefreshCookie) {}

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

    public record SignUpCommand(
            String userId,
            String email,
            String password,
            String password2,
            String username,
            LocalDate birthDate,
            String gender,
            boolean agreeWhether,
            String idCheckToken,
            String emailCheckToken
    ) {}
}
