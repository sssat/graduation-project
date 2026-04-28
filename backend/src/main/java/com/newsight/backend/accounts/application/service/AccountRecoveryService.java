package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.mail.MailService;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.common.exception.NotFoundException;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
class AccountRecoveryService {

    private final SpringDataUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final MailService mailService;
    private final EntityManager em;

    @Transactional(readOnly = true)
    AccountsService.FindIdResult findUserId(AccountsService.FindIdCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        AccountSupport.ensureNotBlank(cmd.email(), "email");
        AccountSupport.ensureNotBlank(cmd.name(), "name");

        User u = userRepository.findByEmail(cmd.email().trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("No matching account was found."));

        if (!AccountSupport.safe(u.getUserName()).equals(AccountSupport.safe(cmd.name()))) {
            throw new IllegalArgumentException("No matching account was found.");
        }

        return new AccountsService.FindIdResult(u.getUserId());
    }

    AccountsService.FindPasswordResult findPassword(AccountsService.FindPasswordCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        String userId = AccountSupport.safe(cmd.userId()).toLowerCase();
        String name = AccountSupport.safe(cmd.name());
        String email = AccountSupport.safe(cmd.email()).toLowerCase();

        AccountSupport.ensureNotBlank(userId, "user_id");
        AccountSupport.ensureNotBlank(name, "name");
        AccountSupport.ensureNotBlank(email, "email");

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("No matching user was found."));

        if (AccountSupport.isBlank(user.getEmail()) || !user.getEmail().equalsIgnoreCase(email)
                || AccountSupport.isBlank(user.getUserName()) || !user.getUserName().equalsIgnoreCase(name)) {
            throw new NotFoundException("No matching user was found.");
        }

        String tempPassword = AccountSupport.generateTempPassword(10);

        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setPasswordChangedAt(LocalDateTime.now(clock));
        user.rotateRefreshTokenVersion();
        userRepository.save(user);
        em.flush();

        String subject = "[Newsight] Temporary password";
        String body = """
                Hello, %s.

                Your temporary password is shown below.

                Temporary password: %s

                Please log in and change your password.
                """.formatted(AccountSupport.safe(user.getUserName()), tempPassword);

        try {
            mailService.sendText(user.getEmail(), subject, body);
        } catch (RuntimeException e) {
            log.error("Failed to send temporary password email. userSeq={}, email={}", user.getUserSeq(), user.getEmail(), e);
            throw new IllegalStateException("Failed to send temporary password email. Password was not changed.", e);
        }

        return new AccountsService.FindPasswordResult("Temporary password has been sent by email.");
    }
}
