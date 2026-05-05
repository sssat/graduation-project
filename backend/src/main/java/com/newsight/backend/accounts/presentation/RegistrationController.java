package com.newsight.backend.accounts.presentation;

import com.newsight.backend.accounts.application.service.AccountsService;
import com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailInfo;
import com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailPrecheckRequestDto;
import com.newsight.backend.accounts.presentation.dto.EmailPrecheckDto.EmailPrecheckResponseDto;
import com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.IdPrecheckRequestDto;
import com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.IdPrecheckResponseDto;
import com.newsight.backend.accounts.presentation.dto.IdPrecheckDto.UserIdInfo;
import com.newsight.backend.accounts.presentation.dto.SignUpDto.SignUpRequestDto;
import com.newsight.backend.accounts.presentation.dto.SignUpDto.SignUpResponseDto;
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
@RequestMapping("/api/auth/register")
@Tag(name = "Registration", description = "Account registration and duplicate checks")
public class RegistrationController {

    private final AccountsService accountsService;

    @PostMapping("/precheck/user-id")
    @Operation(summary = "Check user ID availability")
    public ResponseEntity<IdPrecheckResponseDto> precheckUserId(@Valid @RequestBody IdPrecheckRequestDto body) {
        AccountsService.IdPrecheckResult r = accountsService.precheckUserId(body.userId());

        return ResponseEntity.ok(new IdPrecheckResponseDto(
                new UserIdInfo(
                        r.user_id().valid(),
                        r.user_id().status()
                ),
                r.id_check_token(),
                r.expires_in()
        ));
    }

    @PostMapping("/precheck/email")
    @Operation(summary = "Check email availability")
    public ResponseEntity<EmailPrecheckResponseDto> precheckEmail(@Valid @RequestBody EmailPrecheckRequestDto body) {
        AccountsService.EmailPrecheckResult r = accountsService.precheckEmail(body.email());

        return ResponseEntity.ok(new EmailPrecheckResponseDto(
                new EmailInfo(
                        r.email().valid(),
                        r.email().status()
                ),
                r.email_check_token(),
                r.expires_in(),
                r.message()
        ));
    }

    @PostMapping("")
    @Operation(summary = "Create account")
    public ResponseEntity<SignUpResponseDto> signUp(@Valid @RequestBody SignUpRequestDto body) {
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
}
