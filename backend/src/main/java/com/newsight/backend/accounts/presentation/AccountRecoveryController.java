package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.FindIdDto.FindIdRequestDto;
import com.newsight.backend.accounts.presentation.dto.FindIdDto.FindIdResponseDto;
import com.newsight.backend.accounts.presentation.dto.FindPasswordDto.FindPasswordRequestDto;
import com.newsight.backend.accounts.presentation.dto.FindPasswordDto.FindPasswordResponseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
@Tag(name = "Account Recovery", description = "User ID lookup and temporary password APIs")
public class AccountRecoveryController {

    private final AccountsService accountsService;

    @PostMapping("/find-id")
    @Operation(summary = "Find user ID")
    public ResponseEntity<FindIdResponseDto> findId(@Valid @RequestBody FindIdRequestDto body) {
        AccountsService.FindIdResult r = accountsService.findUserId(
                new AccountsService.FindIdCommand(body.email(), body.name())
        );
        return ResponseEntity.ok(FindIdResponseDto.success(r.user_id()));
    }

    @PostMapping("/find-password")
    @Operation(summary = "Issue temporary password")
    public ResponseEntity<FindPasswordResponseDto> findPassword(@Valid @RequestBody FindPasswordRequestDto body) {
        AccountsService.FindPasswordResult r = accountsService.findPassword(
                new AccountsService.FindPasswordCommand(body.userId(), body.name(), body.email())
        );
        return ResponseEntity.ok(FindPasswordResponseDto.success(r.message()));
    }
}
