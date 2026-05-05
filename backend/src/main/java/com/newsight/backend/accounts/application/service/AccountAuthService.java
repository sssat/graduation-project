package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.LoginLog;
import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataLoginLogRepository;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.accounts.infrastructure.security.JwtService;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
class AccountAuthService {

    private final SpringDataUserRepository userRepository;
    private final SpringDataLoginLogRepository loginLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final JwtService jwtService;

    @Transactional(noRollbackFor = BadCredentialsException.class)
    AccountsService.LoginIssueResult loginIssue(String userId, String password, String ip, String ua) {
        String uid = AccountSupport.safe(userId).toLowerCase();

        if (uid.isEmpty() || password == null) {
            appendLoginLog(null, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("Invalid user id or password.");
        }

        User user = userRepository.findByUserId(uid).orElse(null);

        if (user == null) {
            appendLoginLog(null, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("Invalid user id or password.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            appendLoginLog(user, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("Invalid user id or password.");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        userRepository.updateLastLoginAt(user.getUserSeq(), now);
        user.setLastLoginAt(now);

        appendLoginLog(user, uid, now, true, ip, ua);

        String access = jwtService.issueAccessToken(user);
        String refresh = jwtService.issueRefreshToken(user);

        return new AccountsService.LoginIssueResult(
                new AccountsService.LoginResponse(access, AccountSupport.mapRole(user), user.getUserSeq(), user.getUserId(), "Logged in."),
                refresh
        );
    }

    AccountsService.TokenRefreshIssueResult refreshIssue(String refreshToken) {
        AccountSupport.ensureNotBlank(refreshToken, "refresh");

        JwtService.RefreshTokenClaims claims = jwtService.verifyRefresh(refreshToken);
        User user = userRepository.findById(claims.userSeq())
                .orElseThrow(() -> new IllegalArgumentException("user not found for this refresh token"));

        if (user.currentRefreshTokenVersion() != claims.refreshTokenVersion()) {
            throw new IllegalArgumentException("Refresh token is invalid or expired.");
        }

        user.rotateRefreshTokenVersion();
        userRepository.saveAndFlush(user);

        String newAccess = jwtService.issueAccessToken(user);
        String newRefresh = jwtService.issueRefreshToken(user);

        return new AccountsService.TokenRefreshIssueResult(
                new AccountsService.TokenRefreshResponse(newAccess),
                newRefresh
        );
    }

    AccountsService.LogoutResult logout(String refreshToken) {
        if (!AccountSupport.isBlank(refreshToken)) {
            try {
                JwtService.RefreshTokenClaims claims = jwtService.verifyRefresh(refreshToken);
                userRepository.findById(claims.userSeq()).ifPresent(user -> {
                    if (user.currentRefreshTokenVersion() == claims.refreshTokenVersion()) {
                        user.rotateRefreshTokenVersion();
                        userRepository.save(user);
                    }
                });
            } catch (RuntimeException ignore) {
                // Always let logout clear the client cookie, even if the token is already invalid.
            }
        }
        return new AccountsService.LogoutResult("Logged out.");
    }

    private void appendLoginLog(User user, String inputId, LocalDateTime attemptedAt, boolean success, String ip, String ua) {
        LoginLog log = LoginLog.builder()
                .user(user)
                .inputId(inputId)
                .attemptedAt(attemptedAt)
                .isSuccess(success)
                .ipAddress(ip)
                .userAgent(ua)
                .build();

        loginLogRepository.save(log);
    }
}
