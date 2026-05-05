package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.ChangePasswordDto.ChangePasswordRequestDto;
import com.newsight.backend.accounts.presentation.dto.ChangePasswordDto.ChangePasswordResponseDto;
import com.newsight.backend.common.security.CurrentUserExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
@Tag(name = "Account Password", description = "Authenticated password management APIs")
@SecurityRequirement(name = "bearerAuth")
public class AccountPasswordController {

    private final AccountsService accountsService;

    @PostMapping("/change-password")
    @Operation(summary = "Change password")
    public ResponseEntity<ChangePasswordResponseDto> changePassword(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ChangePasswordRequestDto body,
            @Parameter(hidden = true) HttpServletRequest request
    ) {
        Long actorUserSeq = CurrentUserExtractor.requireUserSeq(jwt);

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
            builder.header(HttpHeaders.SET_COOKIE, AccountControllerSupport.clearRefreshCookie(request).toString());
        }

        return builder.body(ChangePasswordResponseDto.success(r.message()));
    }
}
