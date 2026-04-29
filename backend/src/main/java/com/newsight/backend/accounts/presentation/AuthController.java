package com.newsight.backend.accounts.presentation;

import static com.newsight.backend.accounts.presentation.AccountControllerSupport.REFRESH_COOKIE_NAME;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.LoginDto.LoginRequestDto;
import com.newsight.backend.accounts.presentation.dto.LoginDto.LoginResponseDto;
import com.newsight.backend.accounts.presentation.dto.LogoutDto.LogoutResponseDto;
import com.newsight.backend.accounts.presentation.dto.TokenRefreshDto.TokenRefreshResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Login, token refresh, and logout APIs")
public class AuthController {

    private final AccountsService accountsService;

    @Value("${app.jwt.refresh-minutes:60}")
    private int refreshMinutes;

    @PostMapping({"/login", "/login/"})
    @Operation(summary = "Login")
    public ResponseEntity<LoginResponseDto> login(
            @Valid @RequestBody LoginRequestDto body,
            @Parameter(hidden = true) HttpServletRequest request
    ) {
        String ip = AccountControllerSupport.extractClientIp(request);
        String ua = request.getHeader("User-Agent");

        AccountsService.LoginIssueResult r = accountsService.loginIssue(
                body.userId(),
                body.password(),
                ip,
                ua
        );

        ResponseCookie refreshCookie = AccountControllerSupport.buildRefreshCookie(
                r.refreshToken(),
                request,
                refreshMinutes
        );

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

    @PostMapping({"/refresh", "/refresh/"})
    @Operation(summary = "Refresh access token")
    public ResponseEntity<TokenRefreshResponseDto> refresh(@Parameter(hidden = true) HttpServletRequest request) {
        String refresh = AccountControllerSupport.readCookie(request, REFRESH_COOKIE_NAME);
        if (refresh == null || refresh.isBlank()) {
            return ResponseEntity.status(401).body(TokenRefreshResponseDto.failure("由ы봽?덉떆 ?좏겙???놁뒿?덈떎."));
        }

        AccountsService.TokenRefreshIssueResult r = accountsService.refreshIssue(refresh);

        ResponseCookie rotated = AccountControllerSupport.buildRefreshCookie(
                r.refreshToken(),
                request,
                refreshMinutes
        );
        TokenRefreshResponseDto resp = TokenRefreshResponseDto.success(r.response().access());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, rotated.toString())
                .body(resp);
    }

    @PostMapping({"/logout", "/logout/"})
    @Operation(summary = "Logout")
    public ResponseEntity<LogoutResponseDto> logout(@Parameter(hidden = true) HttpServletRequest request) {
        String refresh = AccountControllerSupport.readCookie(request, REFRESH_COOKIE_NAME);
        accountsService.logout(refresh);
        ResponseCookie cleared = AccountControllerSupport.clearRefreshCookie(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cleared.toString())
                .body(LogoutResponseDto.defaultSuccess());
    }
}
