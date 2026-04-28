package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.UserLevel;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserLevelRepository;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Base64;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
class AccountRegistrationService {

    private final SpringDataUserRepository userRepository;
    private final SpringDataUserLevelRepository userLevelRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Value("${app.precheck.secret}")
    private String precheckSecret;

    @Value("${app.precheck.ttl-seconds:600}")
    private int precheckTtlSec;

    @Value("${app.allowed-email-domains:gmail.com,naver.com,kakao.com}")
    private String allowedEmailDomainsProp;

    private Set<String> allowedEmailDomains;

    private static final Pattern USER_ID_PATTERN = Pattern.compile("^[a-z0-9]{5,20}$");
    private static final Pattern USERNAME_PATTERN =
            Pattern.compile("^(?=.{2,20}$)[가-힣a-zA-Z]+(?: [가-힣a-zA-Z]+)*$");

    @PostConstruct
    void init() {
        if (precheckSecret == null || precheckSecret.isBlank()) {
            throw new IllegalStateException("app.precheck.secret is required.");
        }

        allowedEmailDomains = Arrays.stream((allowedEmailDomainsProp == null ? "" : allowedEmailDomainsProp).split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional(readOnly = true)
    AccountsService.IdPrecheckResult precheckUserId(String userId) {
        String raw = AccountSupport.safe(userId);

        if (raw.isEmpty() || !USER_ID_PATTERN.matcher(raw).matches()) {
            return new AccountsService.IdPrecheckResult(
                    new AccountsService.UserIdInfo(false, PrecheckStatus.INVALID.value),
                    null,
                    null
            );
        }

        if (userRepository.existsByUserId(raw)) {
            return new AccountsService.IdPrecheckResult(
                    new AccountsService.UserIdInfo(true, PrecheckStatus.TAKEN.value),
                    null,
                    null
            );
        }

        String token = signPrecheckToken("user_id", raw);
        return new AccountsService.IdPrecheckResult(
                new AccountsService.UserIdInfo(true, PrecheckStatus.AVAILABLE.value),
                token,
                precheckTtlSec
        );
    }

    @Transactional(readOnly = true)
    AccountsService.EmailPrecheckResult precheckEmail(String email) {
        String raw = AccountSupport.safe(email);

        EmailValidity validity = validateEmailPolicy(raw);
        if (!validity.valid) {
            return new AccountsService.EmailPrecheckResult(
                    new AccountsService.EmailInfo(false, PrecheckStatus.INVALID.value),
                    null,
                    null,
                    validity.message
            );
        }

        if (userRepository.existsByEmail(raw)) {
            return new AccountsService.EmailPrecheckResult(
                    new AccountsService.EmailInfo(true, PrecheckStatus.TAKEN.value),
                    null,
                    null,
                    "Email is already in use."
            );
        }

        String token = signPrecheckToken("email", raw.toLowerCase());
        return new AccountsService.EmailPrecheckResult(
                new AccountsService.EmailInfo(true, PrecheckStatus.AVAILABLE.value),
                token,
                precheckTtlSec,
                "Email is available."
        );
    }

    AccountsService.SignUpResult signUp(AccountsService.SignUpCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        AccountSupport.ensureNotBlank(cmd.userId(), "userId");
        AccountSupport.ensureNotBlank(cmd.email(), "email");
        AccountSupport.ensureNotBlank(cmd.password(), "password");
        AccountSupport.ensureNotBlank(cmd.password2(), "password2");
        AccountSupport.ensureNotBlank(cmd.username(), "username");
        if (cmd.birthDate() == null) throw new IllegalArgumentException("required field is missing: birthDate");
        AccountSupport.ensureNotBlank(cmd.gender(), "gender");

        String userId = AccountSupport.safe(cmd.userId()).toLowerCase();
        String email = AccountSupport.safe(cmd.email()).toLowerCase();

        if (!USER_ID_PATTERN.matcher(userId).matches()) {
            throw new IllegalArgumentException("userId format is invalid.");
        }

        if (!USERNAME_PATTERN.matcher(AccountSupport.safe(cmd.username())).matches()) {
            throw new IllegalArgumentException("username format is invalid.");
        }

        AccountSupport.validateBirthDatePolicy(cmd.birthDate(), clock);

        EmailValidity emailValidity = validateEmailPolicy(email);
        if (!emailValidity.valid) throw new IllegalArgumentException(emailValidity.message);

        if (!cmd.password().equals(cmd.password2())) {
            throw new IllegalArgumentException("Password confirmation does not match.");
        }

        String pwError = AccountSupport.passwordPolicyError(cmd.password(), userId);
        if (pwError != null) throw new IllegalArgumentException(pwError);

        if (AccountSupport.isBlank(cmd.idCheckToken()) || !verifyPrecheckToken(cmd.idCheckToken(), "user_id", userId, precheckTtlSec)) {
            throw new IllegalArgumentException("Please run user id precheck again.");
        }

        if (AccountSupport.isBlank(cmd.emailCheckToken()) || !verifyPrecheckToken(cmd.emailCheckToken(), "email", email, precheckTtlSec)) {
            throw new IllegalArgumentException("Please run email precheck again.");
        }

        if (!cmd.agreeWhether()) {
            throw new IllegalArgumentException("Terms agreement is required.");
        }

        UserLevel defaultLevel = userLevelRepository.findById((short) 0)
                .orElseThrow(() -> new IllegalStateException("USER(0) level is missing."));

        try {
            User user = User.builder()
                    .userId(userId)
                    .email(email)
                    .userName(AccountSupport.safe(cmd.username()))
                    .passwordHash(passwordEncoder.encode(cmd.password()))
                    .gender(AccountSupport.parseGender(cmd.gender()))
                    .birthDate(cmd.birthDate())
                    .userLevel(defaultLevel)
                    .build();

            userRepository.save(user);

            return new AccountsService.SignUpResult(user.getUserSeq(), user.getJoinedAt());
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException("userId or email is already in use.");
        }
    }

    private EmailValidity validateEmailPolicy(String email) {
        if (email == null || email.isBlank()) {
            return EmailValidity.invalid("Email is required.");
        }

        int at = email.indexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return EmailValidity.invalid("Email format is invalid.");
        }

        String domain = email.substring(at + 1).toLowerCase();
        if (!allowedEmailDomains.contains(domain)) {
            String joined = String.join(", ", allowedEmailDomains);
            return EmailValidity.invalid("Email domain is not allowed. (" + joined + ")");
        }

        return EmailValidity.ok();
    }

    private String signPrecheckToken(String kind, String subject) {
        long nowSec = LocalDateTime.now(clock).atZone(ZoneId.systemDefault()).toEpochSecond();

        String p0 = b64Url(kind);
        String p1 = b64Url(subject);
        String p2 = Long.toString(nowSec);
        String header = p0 + "." + p1 + "." + p2;

        byte[] sig = hmacSha256Raw(header, "precheck:" + kind + ":" + precheckSecret);
        String p3 = b64Url(sig);

        return header + "." + p3;
    }

    private boolean verifyPrecheckToken(String token, String kind, String subject, int maxAgeSec) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 4) return false;

            String kindPart = new String(b64UrlDecode(parts[0]), StandardCharsets.UTF_8);
            String subjectPart = new String(b64UrlDecode(parts[1]), StandardCharsets.UTF_8);
            long ts = Long.parseLong(parts[2]);
            byte[] sigBytes = b64UrlDecode(parts[3]);

            if (!Objects.equals(kind, kindPart)) return false;
            if (!subject.equalsIgnoreCase(subjectPart)) return false;

            long nowSec = LocalDateTime.now(clock).atZone(ZoneId.systemDefault()).toEpochSecond();
            if (nowSec - ts > maxAgeSec) return false;

            String header = parts[0] + "." + parts[1] + "." + parts[2];
            byte[] expect = hmacSha256Raw(header, "precheck:" + kind + ":" + precheckSecret);

            return MessageDigest.isEqual(sigBytes, expect);
        } catch (Exception e) {
            return false;
        }
    }

    private static String b64Url(String s) {
        return b64Url(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String b64Url(byte[] raw) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    private static byte[] b64UrlDecode(String p) {
        return Base64.getUrlDecoder().decode(p);
    }

    private static byte[] hmacSha256Raw(String text, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(text.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private enum PrecheckStatus {
        AVAILABLE("available"),
        INVALID("invalid"),
        TAKEN("taken");

        final String value;

        PrecheckStatus(String v) {
            this.value = v;
        }
    }

    private record EmailValidity(boolean valid, String message) {
        static EmailValidity ok() {
            return new EmailValidity(true, "");
        }

        static EmailValidity invalid(String msg) {
            return new EmailValidity(false, msg);
        }
    }
}
