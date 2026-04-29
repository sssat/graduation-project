package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.AdminDashboardLoginLogsRequestDto;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.AdminDashboardLoginLogsResponseDto;
import com.newsight.backend.accounts.presentation.dto.AdminDashboardLoginLogsDto.LoginLogItemDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admins/dashboard")
@Tag(name = "Admin Dashboard", description = "Administrator dashboard APIs")
@SecurityRequirement(name = "bearerAuth")
public class AdminLoginLogController {

    private final AccountsService accountsService;

    @GetMapping({"/login-logs", "/login-logs/"})
    @Operation(summary = "List login logs")
    public ResponseEntity<AdminDashboardLoginLogsResponseDto> listAdminDashboardLoginLogs(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", required = false) Integer size
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

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
}
