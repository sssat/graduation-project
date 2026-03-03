// backend/src/main/java/com/newsight/backend/accounts/presentation/AccountsController.java
package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.AdminDemoteDto.AdminDemoteRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminDemoteDto.AdminDemoteResponseDto;
import com.newsight.backend.accounts.presentation.dto.AdminPromoteDto.AdminPromoteRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminPromoteDto.AdminPromoteResponseDto;
import com.newsight.backend.accounts.presentation.dto.ChangePasswordDto.ChangePasswordRequestDto;
import com.newsight.backend.accounts.presentation.dto.ChangePasswordDto.ChangePasswordResponseDto;
import com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailPrecheckRequestDto;
import com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailPrecheckResponseDto;
import com.newsight.backend.accounts.presentation.dto.FindIdDto.FindIdRequestDto;
import com.newsight.backend.accounts.presentation.dto.FindIdDto.FindIdResponseDto;
import com.newsight.backend.accounts.presentation.dto.FindPasswordDto.FindPasswordRequestDto;
import com.newsight.backend.accounts.presentation.dto.FindPasswordDto.FindPasswordResponseDto;
import com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.IdPrecheckRequestDto;
import com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.IdPrecheckResponseDto;
import com.newsight.backend.accounts.presentation.dto.LoginDto.LoginRequestDto;
import com.newsight.backend.accounts.presentation.dto.LoginDto.LoginResponseDto;
import com.newsight.backend.accounts.presentation.dto.LogoutDto.LogoutResponseDto;
import com.newsight.backend.accounts.presentation.dto.SignUpDto.SignUpRequestDto;
import com.newsight.backend.accounts.presentation.dto.SignUpDto.SignUpResponseDto;
import com.newsight.backend.accounts.presentation.dto.TokenRefreshDto.TokenRefreshResponseDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListItemDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListRequestDto;
import com.newsight.backend.accounts.presentation.dto.UserListDto.UserListResponseDto;
import com.newsight.backend.accounts.presentation.dto.WithdrawDto.WithdrawRequestDto;
import com.newsight.backend.accounts.presentation.dto.WithdrawDto.WithdrawResponseDto;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.AdminDashboardLoginLogsRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.AdminDashboardLoginLogsResponseDto;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.LoginLogItemDto;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class AccountsController {

    private final AccountsService accountsService;

    private static final String REFRESH_COOKIE_NAME = "refresh";

    @Value("${app.jwt.refresh-minutes:60}")
    private int refreshMinutes;

    // ─────────────────────────────────────────────────────────
    // 1) 아이디 사전검사
    // POST /api/auth/register/precheck/user-id/
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/register/precheck/user-id", "/auth/register/precheck/user-id/"})
    public ResponseEntity<IdPrecheckResponseDto> precheckUserId(@RequestBody IdPrecheckRequestDto body) {
        AccountsService.IdPrecheckResult r = accountsService.precheckUserId(body.userId());

        return ResponseEntity.ok(new IdPrecheckResponseDto(
                new com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.UserIdInfo(
                        r.user_id().valid(),
                        r.user_id().status()
                ),
                r.id_check_token(),
                r.expires_in()
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 2) 이메일 사전검사
    // POST /api/auth/register/precheck/email/
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/register/precheck/email", "/auth/register/precheck/email/"})
    public ResponseEntity<EmailPrecheckResponseDto> precheckEmail(@RequestBody EmailPrecheckRequestDto body) {
        AccountsService.EmailPrecheckResult r = accountsService.precheckEmail(body.email());

        return ResponseEntity.ok(new EmailPrecheckResponseDto(
                new com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailInfo(
                        r.email().valid(),
                        r.email().status()
                ),
                r.email_check_token(),
                r.expires_in(),
                r.message()
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 3) 회원가입
    // POST /api/auth/register/
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/register", "/auth/register/"})
    public ResponseEntity<SignUpResponseDto> signUp(@RequestBody SignUpRequestDto body) {
        AccountsService.SignUpCommand cmd = new AccountsService.SignUpCommand(
                body.userId(),
                body.email(),
                body.password(),
                body.password2(),
                body.username(),
                body.birthDate(),
                body.gender(),
                Boolean.TRUE.equals(body.agreeWhether()),
                body.idCheckToken(),
                body.emailCheckToken()
        );

        AccountsService.SignUpResult r = accountsService.signUp(cmd);
        return ResponseEntity.status(201).body(SignUpResponseDto.of(r.user_seq(), r.joined_at()));
    }

    // ─────────────────────────────────────────────────────────
    // 4) 로그인
    // POST /api/auth/login
    // - refresh 토큰은 HttpOnly 쿠키로 내려줌
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/login", "/auth/login/"})
    public ResponseEntity<LoginResponseDto> login(
            @RequestBody LoginRequestDto body,
            HttpServletRequest request
    ) {
        String ip = extractClientIp(request);
        String ua = request.getHeader("User-Agent");

        AccountsService.LoginIssueResult r = accountsService.loginIssue(
                body.userId(),
                body.password(),
                ip,
                ua
        );

        ResponseCookie refreshCookie = buildRefreshCookie(r.refreshToken(), request);

        LoginResponseDto resp = new LoginResponseDto(
                r.response().access(),
                r.response().role(),
                r.response().user_seq(),
                r.response().user_id(),
                r.response().message()
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(resp);
    }

    // ─────────────────────────────────────────────────────────
    // 5) 토큰 갱신
    // POST /api/auth/refresh
    // - refresh 쿠키 검증 → access + refresh 재발급(쿠키 갱신)
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/refresh", "/auth/refresh/"})
    public ResponseEntity<TokenRefreshResponseDto> refresh(HttpServletRequest request) {
        String refresh = readCookie(request, REFRESH_COOKIE_NAME);
        if (refresh == null || refresh.isBlank()) {
            return ResponseEntity.status(401).body(TokenRefreshResponseDto.failure("리프레시 토큰이 없습니다."));
        }

        AccountsService.TokenRefreshIssueResult r = accountsService.refreshIssue(refresh);

        ResponseCookie rotated = buildRefreshCookie(r.refreshToken(), request);
        TokenRefreshResponseDto resp = TokenRefreshResponseDto.success(r.response().access());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, rotated.toString())
                .body(resp);
    }

    // ─────────────────────────────────────────────────────────
    // 6) 로그아웃
    // POST /api/auth/logout
    // - refresh 쿠키 제거
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/logout", "/auth/logout/"})
    public ResponseEntity<LogoutResponseDto> logout(HttpServletRequest request) {
        accountsService.logout();
        ResponseCookie cleared = clearRefreshCookie(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cleared.toString())
                .body(LogoutResponseDto.defaultSuccess());
    }

    // ─────────────────────────────────────────────────────────
    // 7) 아이디 찾기
    // POST /api/auth/find-id
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/find-id", "/auth/find-id/"})
    public ResponseEntity<FindIdResponseDto> findId(@RequestBody FindIdRequestDto body) {
        AccountsService.FindIdResult r = accountsService.findUserId(
                new AccountsService.FindIdCommand(body.email(), body.name())
        );
        return ResponseEntity.ok(FindIdResponseDto.success(r.user_id()));
    }

    // ─────────────────────────────────────────────────────────
    // 8) 비밀번호 찾기 (임시 비밀번호 이메일 발송)
    // POST /api/auth/find-password
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/find-password", "/auth/find-password/"})
    public ResponseEntity<FindPasswordResponseDto> findPassword(@RequestBody FindPasswordRequestDto body) {
        AccountsService.FindPasswordResult r = accountsService.findPassword(
                new AccountsService.FindPasswordCommand(body.userId(), body.name(), body.email())
        );
        return ResponseEntity.ok(FindPasswordResponseDto.success(r.message()));
    }

    // ─────────────────────────────────────────────────────────
    // 9) 비밀번호 변경 (로그인 필요)
    // POST /api/auth/change-password
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/auth/change-password", "/auth/change-password/"})
    public ResponseEntity<ChangePasswordResponseDto> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ChangePasswordRequestDto body,
            HttpServletRequest request
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AccountsService.ChangePasswordResult r = accountsService.changePassword(
                new AccountsService.ChangePasswordCommand(
                        actorUserSeq,
                        body.currentPassword(),
                        body.newPassword(),
                        body.newPasswordConfirm()
                )
        );

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (r.clearRefreshCookie()) {
            builder.header(HttpHeaders.SET_COOKIE, clearRefreshCookie(request).toString());
        }

        return builder.body(ChangePasswordResponseDto.success(r.message()));
    }

    // ─────────────────────────────────────────────────────────
    // 10) 회원 목록 (슈퍼 관리자)
    // GET /api/admins/users?page=&size=&q=
    // ─────────────────────────────────────────────────────────
    @GetMapping({"/admins/users", "/admins/users/"})
    public ResponseEntity<UserListResponseDto> listUsers(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size,
            @RequestParam(value = "q", required = false) String q
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        UserListRequestDto req = new UserListRequestDto(page, size, q);

        AccountsService.UserListResult r = accountsService.listUsers(
                new AccountsService.UserListQuery(actorUserSeq, req.pageOrDefault(), req.sizeOrDefault(), req.q())
        );

        List<UserListItemDto> items = r.items().stream()
                .map(x -> new UserListItemDto(
                        x.user_seq(),
                        x.user_id(),
                        x.user_name(),
                        x.grade_code(),
                        x.grade_name(),
                        x.email(),
                        x.birth_date(),
                        x.gender(),
                        x.last_login_at(),
                        x.joined_at(),
                        x.granted_at(),
                        x.password_changed_at()
                ))
                .toList();

        return ResponseEntity.ok(UserListResponseDto.success(
                items,
                r.page(),
                r.size(),
                r.total_count(),
                r.total_pages(),
                null
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 10-1) 관리자 대시보드 - 로그인 로그 조회 (관리자 이상)
    // GET /api/admins/dashboard/login-logs?page=&size=
    // ─────────────────────────────────────────────────────────
    @GetMapping({"/admins/dashboard/login-logs", "/admins/dashboard/login-logs/"})
    public ResponseEntity<AdminDashboardLoginLogsResponseDto> listAdminDashboardLoginLogs(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AdminDashboardLoginLogsRequestDto req = new AdminDashboardLoginLogsRequestDto(page, size);

        AccountsService.AdminLoginLogListResult r = accountsService.listAdminDashboardLoginLogs(
                new AccountsService.AdminLoginLogListQuery(actorUserSeq, req.pageOrDefault(), req.sizeOrDefault())
        );

        List<LoginLogItemDto> items = r.items().stream()
                .map(x -> new LoginLogItemDto(
                        x.login_log_seq(),
                        x.input_id(),
                        x.attempted_at(),
                        x.user_seq(),
                        x.is_success(),
                        x.ip_address(),
                        x.user_agent()
                ))
                .toList();

        return ResponseEntity.ok(new AdminDashboardLoginLogsResponseDto(
                items,
                r.page(),
                r.size(),
                r.total_count(),
                r.total_pages()
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 11) 관리자 승격 (슈퍼 관리자)
    // POST /api/admins/promote
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/admins/promote", "/admins/promote/"})
    public ResponseEntity<AdminPromoteResponseDto> promote(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody AdminPromoteRequestDto body
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AccountsService.PromoteResult r = accountsService.promoteToAdmin(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminPromoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.admin_level(),
                r.granted_at(),
                "관리자 권한이 부여되었습니다."
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 12) 관리자 강등 (슈퍼 관리자)
    // POST /api/admins/demote
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/admins/demote", "/admins/demote/"})
    public ResponseEntity<AdminDemoteResponseDto> demote(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody AdminDemoteRequestDto body
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AccountsService.DemoteResult r = accountsService.demoteToUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(AdminDemoteResponseDto.success(
                r.user_seq(),
                r.acted_seq(),
                r.demoted_at(),
                "관리자 권한이 해제되었습니다."
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 13) 강제 탈퇴 (슈퍼 관리자)
    // POST /api/admins/users/withdraw
    // ─────────────────────────────────────────────────────────
    @PostMapping({"/admins/users/withdraw", "/admins/users/withdraw/"})
    public ResponseEntity<WithdrawResponseDto> withdraw(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody WithdrawRequestDto body
    ) {
        Long actorUserSeq = requireUserSeq(jwt);

        AccountsService.WithdrawResult r = accountsService.withdrawUser(body.userSeq(), actorUserSeq);

        return ResponseEntity.ok(new WithdrawResponseDto(
                r.user_seq(),
                r.deleted_at(),
                r.acted_seq()
        ));
    }

    // ─────────────────────────────────────────────────────────
    // 내부 헬퍼
    // ─────────────────────────────────────────────────────────

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
        // 호환: subject에 userSeq를 넣는 경우
        try {
            String sub = jwt.getSubject();
            if (sub != null && !sub.isBlank()) return Long.parseLong(sub.trim());
        } catch (Exception ignore) {
            // ignore
        }
        throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
    }

    private ResponseCookie buildRefreshCookie(String refreshToken, HttpServletRequest request) {
        long maxAgeSec = Math.max(60L, Duration.ofMinutes(Math.max(1, refreshMinutes)).toSeconds());

        // SameSite=None은 Secure가 필수라서, HTTPS 환경에서만 동작하도록 하는 편이 안전하다.
        // 로컬에서 http로 테스트하려면 프론트/백을 같은 사이트로 맞추거나(동일 도메인),
        // HTTPS 터널(예: https) 환경으로 테스트하는 것을 권장.
        boolean secure = isHttps(request);

        return ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken == null ? "" : refreshToken)
                .httpOnly(true)
                .secure(secure)
                .sameSite("None")
                .path("/api/auth")
                .maxAge(maxAgeSec)
                .build();
    }

    private ResponseCookie clearRefreshCookie(HttpServletRequest request) {
        boolean secure = isHttps(request);

        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("None")
                .path("/api/auth")
                .maxAge(0)
                .build();
    }

    private static boolean isHttps(HttpServletRequest request) {
        if (request == null) return false;

        // 프록시 뒤에서 https인 경우
        String xfProto = request.getHeader("X-Forwarded-Proto");
        if (xfProto != null && xfProto.equalsIgnoreCase("https")) return true;

        return request.isSecure();
    }

    private static String readCookie(HttpServletRequest request, String name) {
        if (request == null || name == null) return null;
        if (request.getCookies() == null) return null;

        for (var c : request.getCookies()) {
            if (c != null && name.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }

    private static String extractClientIp(HttpServletRequest request) {
        if (request == null) return "";

        // 프록시/로드밸런서 환경 우선
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            // 첫 번째 IP가 원본 클라이언트
            String first = xff.split(",")[0].trim();
            if (!first.isBlank()) return first;
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();

        return request.getRemoteAddr() == null ? "" : request.getRemoteAddr();
    }
}