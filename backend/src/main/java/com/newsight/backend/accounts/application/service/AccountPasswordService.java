package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
class AccountPasswordService {

    private final SpringDataUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    AccountsService.ChangePasswordResult changePassword(AccountsService.ChangePasswordCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        if (cmd.actorUserSeq() == null) {
            throw new AuthenticationCredentialsNotFoundException("Login is required.");
        }

        AccountSupport.ensureNotBlank(cmd.currentPassword(), "currentPassword");
        AccountSupport.ensureNotBlank(cmd.newPassword(), "newPassword");
        AccountSupport.ensureNotBlank(cmd.newPasswordConfirm(), "newPasswordConfirm");

        User user = userRepository.findById(cmd.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));

        if (!passwordEncoder.matches(cmd.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password does not match.");
        }

        if (!cmd.newPassword().equals(cmd.newPasswordConfirm())) {
            throw new IllegalArgumentException("New password confirmation does not match.");
        }

        if (cmd.currentPassword().equals(cmd.newPassword())) {
            throw new IllegalArgumentException("New password cannot be the same as the current password.");
        }

        String pwError = AccountSupport.passwordPolicyError(cmd.newPassword(), user.getUserId());
        if (pwError != null) throw new IllegalArgumentException(pwError);

        user.setPasswordHash(passwordEncoder.encode(cmd.newPassword()));
        user.setPasswordChangedAt(LocalDateTime.now(clock));
        user.rotateRefreshTokenVersion();
        userRepository.save(user);

        return new AccountsService.ChangePasswordResult("Password changed.", true);
    }
}
