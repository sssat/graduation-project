// src/main/java/com/newsight/backend/accounts/application/service/AccountsService.java
package com.newsight.backend.accounts.application.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.newsight.backend.accounts.domain.model.LoginLog;
import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.User.Gender;
import com.newsight.backend.accounts.domain.model.UserLevel;
import com.newsight.backend.accounts.infrastructure.mail.MailService;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataLoginLogRepository;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserLevelRepository;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.accounts.infrastructure.security.JwtService;
import com.newsight.backend.common.exception.NotFoundException;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@RequiredArgsConstructor
@Transactional
public class AccountsService {

    private final SpringDataUserRepository userRepository;
    private final SpringDataUserLevelRepository userLevelRepository;
    private final SpringDataLoginLogRepository loginLogRepository;

    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    private final JwtService jwtService;
    private final MailService mailService;

    @PersistenceContext
    private EntityManager em;

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
            throw new IllegalStateException("app.precheck.secret 설정이 필요합니다.");
        }

        allowedEmailDomains = Arrays.stream((allowedEmailDomainsProp == null ? "" : allowedEmailDomainsProp).split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toUnmodifiableSet());
    }

    // ─────────────────────────────────────────────────────────
    // 1) 아이디 사전검사
    // ─────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public IdPrecheckResult precheckUserId(String userId) {
        String raw = safe(userId);

        if (raw.isEmpty() || !USER_ID_PATTERN.matcher(raw).matches()) {
            return new IdPrecheckResult(
                    new UserIdInfo(false, PrecheckStatus.INVALID.value),
                    null,
                    null
            );
        }

        if (userRepository.existsByUserId(raw)) {
            return new IdPrecheckResult(
                    new UserIdInfo(true, PrecheckStatus.TAKEN.value),
                    null,
                    null
            );
        }

        String token = signPrecheckToken("user_id", raw);
        return new IdPrecheckResult(
                new UserIdInfo(true, PrecheckStatus.AVAILABLE.value),
                token,
                precheckTtlSec
        );
    }

    // ─────────────────────────────────────────────────────────
    // 2) 이메일 사전검사
    // ─────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public EmailPrecheckResult precheckEmail(String email) {
        String raw = safe(email);

        EmailValidity validity = validateEmailPolicy(raw);
        if (!validity.valid) {
            return new EmailPrecheckResult(
                    new EmailInfo(false, PrecheckStatus.INVALID.value),
                    null,
                    null,
                    validity.message
            );
        }

        if (userRepository.existsByEmail(raw)) {
            return new EmailPrecheckResult(
                    new EmailInfo(true, PrecheckStatus.TAKEN.value),
                    null,
                    null,
                    "이미 사용 중인 이메일입니다."
            );
        }

        String token = signPrecheckToken("email", raw.toLowerCase());
        return new EmailPrecheckResult(
                new EmailInfo(true, PrecheckStatus.AVAILABLE.value),
                token,
                precheckTtlSec,
                "사용 가능한 이메일입니다."
        );
    }

    // ─────────────────────────────────────────────────────────
    // 3) 회원가입
    // ─────────────────────────────────────────────────────────
    public SignUpResult signUp(SignUpCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        ensureNotBlank(cmd.userId(), "userId");
        ensureNotBlank(cmd.email(), "email");
        ensureNotBlank(cmd.password(), "password");
        ensureNotBlank(cmd.password2(), "password2");
        ensureNotBlank(cmd.username(), "username");
        if (cmd.birthDate() == null) throw new IllegalArgumentException("필수값 누락: birthDate");
        ensureNotBlank(cmd.gender(), "gender");

        String userId = safe(cmd.userId()).toLowerCase();
        String email = safe(cmd.email()).toLowerCase();

        if (!USER_ID_PATTERN.matcher(userId).matches()) {
            throw new IllegalArgumentException("아이디 형식이 올바르지 않습니다.");
        }

        if (!USERNAME_PATTERN.matcher(safe(cmd.username())).matches()) {
            throw new IllegalArgumentException("이름 형식이 올바르지 않습니다.");
        }

        validateBirthDatePolicy(cmd.birthDate());

        EmailValidity emailValidity = validateEmailPolicy(email);
        if (!emailValidity.valid) throw new IllegalArgumentException(emailValidity.message);

        if (!cmd.password().equals(cmd.password2())) {
            throw new IllegalArgumentException("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        }

        String pwError = passwordPolicyError(cmd.password(), userId);
        if (pwError != null) throw new IllegalArgumentException(pwError);

        if (isBlank(cmd.idCheckToken()) || !verifyPrecheckToken(cmd.idCheckToken(), "user_id", userId, precheckTtlSec)) {
            throw new IllegalArgumentException("아이디 사전검사를 다시 진행해주세요.");
        }

        if (isBlank(cmd.emailCheckToken()) || !verifyPrecheckToken(cmd.emailCheckToken(), "email", email, precheckTtlSec)) {
            throw new IllegalArgumentException("이메일 사전검사를 다시 진행해주세요.");
        }

        if (!cmd.agreeWhether()) {
            throw new IllegalArgumentException("약관 동의가 필요합니다.");
        }

        UserLevel defaultLevel = userLevelRepository.findById((short) 0)
                .orElseThrow(() -> new IllegalStateException("USER(0) 등급이 없습니다."));

        try {
            User user = User.builder()
                    .userId(userId)
                    .email(email)
                    .userName(safe(cmd.username()))
                    .passwordHash(passwordEncoder.encode(cmd.password()))
                    .gender(parseGender(cmd.gender()))
                    .birthDate(cmd.birthDate())
                    .userLevel(defaultLevel)
                    .build();

            userRepository.save(user);

            return new SignUpResult(user.getUserSeq(), user.getJoinedAt());
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException("이미 사용 중인 아이디 또는 이메일입니다.");
        }
    }

    // ─────────────────────────────────────────────────────────
    // 4) 로그인 (토큰 발급 + 로그인 로그)
    // ─────────────────────────────────────────────────────────
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public LoginIssueResult loginIssue(String userId, String password, String ip, String ua) {
        String uid = safe(userId).toLowerCase();

        if (uid.isEmpty() || password == null) {
            appendLoginLog(null, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userRepository.findByUserId(uid).orElse(null);

        if (user == null) {
            appendLoginLog(null, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            appendLoginLog(user, uid, LocalDateTime.now(clock), false, ip, ua);
            throw new BadCredentialsException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        userRepository.updateLastLoginAt(user.getUserSeq(), now);
        user.setLastLoginAt(now);

        appendLoginLog(user, uid, now, true, ip, ua);

        String access = jwtService.issueAccessToken(user);
        String refresh = jwtService.issueRefreshToken(user);

        return new LoginIssueResult(
                new LoginResponse(access, mapRole(user), user.getUserSeq(), user.getUserId(), "로그인되었습니다."),
                refresh
        );
    }

    // ─────────────────────────────────────────────────────────
    // 5) 토큰 갱신
    // ─────────────────────────────────────────────────────────
    public TokenRefreshIssueResult refreshIssue(String refreshToken) {
        ensureNotBlank(refreshToken, "refresh");

        Long userSeq = jwtService.verifyRefreshAndGetUserSeq(refreshToken);
        User user = userRepository.findById(userSeq)
                .orElseThrow(() -> new IllegalArgumentException("user not found for this refresh token"));

        String newAccess = jwtService.issueAccessToken(user);
        String newRefresh = jwtService.issueRefreshToken(user);

        return new TokenRefreshIssueResult(
                new TokenRefreshResponse(newAccess),
                newRefresh
        );
    }

    // ─────────────────────────────────────────────────────────
    // 6) 로그아웃
    // ─────────────────────────────────────────────────────────
    public LogoutResult logout() {
        return new LogoutResult("로그아웃되었습니다.");
    }

    // ─────────────────────────────────────────────────────────
    // 7) 아이디 찾기
    // ─────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public FindIdResult findUserId(FindIdCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        ensureNotBlank(cmd.email(), "email");
        ensureNotBlank(cmd.name(), "name");

        User u = userRepository.findByEmail(cmd.email().trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("일치하는 계정이 없습니다."));

        if (!safe(u.getUserName()).equals(safe(cmd.name()))) {
            throw new IllegalArgumentException("일치하는 계정이 없습니다.");
        }

        return new FindIdResult(u.getUserId());
    }

    // ─────────────────────────────────────────────────────────
    // 8) 비밀번호 찾기 (임시 비밀번호 이메일 발송)
    // ─────────────────────────────────────────────────────────
    public FindPasswordResult findPassword(FindPasswordCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        String userId = safe(cmd.userId());
        String name = safe(cmd.name());
        String email = safe(cmd.email());

        ensureNotBlank(userId, "user_id");
        ensureNotBlank(name, "name");
        ensureNotBlank(email, "email");

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("이름/아이디/이메일이 일치하는 사용자가 없습니다."));

        if (isBlank(user.getEmail()) || !user.getEmail().equalsIgnoreCase(email)
                || isBlank(user.getUserName()) || !user.getUserName().equalsIgnoreCase(name)) {
            throw new NotFoundException("이름/아이디/이메일이 일치하는 사용자가 없습니다.");
        }

        String tempPassword = generateTempPassword(10);

        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setPasswordChangedAt(LocalDateTime.now(clock));
        userRepository.save(user);

        String subject = "[Newsight] 임시 비밀번호 안내";
        String body = """
                안녕하세요, %s님.

                요청하신 임시 비밀번호는 아래와 같습니다.

                임시 비밀번호: %s

                로그인 후 반드시 [비밀번호 변경]에서 새 비밀번호로 변경해 주세요.

                감사합니다.
                """.formatted(safe(user.getUserName()), tempPassword);

        sendAfterCommit(() -> mailService.sendText(user.getEmail(), subject, body));

        return new FindPasswordResult("임시 비밀번호가 이메일로 발송되었습니다.");
    }

    // ─────────────────────────────────────────────────────────
    // 9) 비밀번호 변경
    // ─────────────────────────────────────────────────────────
    public ChangePasswordResult changePassword(ChangePasswordCommand cmd) {
        Objects.requireNonNull(cmd, "cmd");

        if (cmd.actorUserSeq() == null) {
            throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
        }

        ensureNotBlank(cmd.currentPassword(), "currentPassword");
        ensureNotBlank(cmd.newPassword(), "newPassword");
        ensureNotBlank(cmd.newPasswordConfirm(), "newPasswordConfirm");

        User user = userRepository.findById(cmd.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));

        if (!passwordEncoder.matches(cmd.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
        }

        if (!cmd.newPassword().equals(cmd.newPasswordConfirm())) {
            throw new IllegalArgumentException("새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.");
        }

        if (cmd.currentPassword().equals(cmd.newPassword())) {
            throw new IllegalArgumentException("새 비밀번호가 현재 비밀번호와 동일할 수 없습니다.");
        }

        String pwError = passwordPolicyError(cmd.newPassword(), user.getUserId());
        if (pwError != null) throw new IllegalArgumentException(pwError);

        user.setPasswordHash(passwordEncoder.encode(cmd.newPassword()));
        user.setPasswordChangedAt(LocalDateTime.now(clock));
        userRepository.save(user);

        return new ChangePasswordResult("비밀번호가 변경되었습니다.", true);
    }

    // ─────────────────────────────────────────────────────────
    // 10) 회원 목록 (슈퍼 관리자)
    // ─────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public UserListResult listUsers(UserListQuery query) {
        Objects.requireNonNull(query, "query");
        if (query.actorUserSeq() == null) throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");

        User actor = userRepository.findByUserSeq(query.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(actor) != 2) throw new SecurityException("슈퍼 관리자만 접근할 수 있습니다.");

        int page = Math.max(1, query.page());
        int size = Math.max(1, Math.min(100, query.size()));
        int offset = (page - 1) * size;

        List<String> terms = splitTerms(safe(query.q()));
        Integer roleHint = extractRoleHint(terms);

        List<String> filteredTerms = terms.stream()
                .filter(t -> !isRoleWord(t) && !isPureRoleCode(t))
                .toList();

        StringBuilder where = new StringBuilder(" where 1=1 ");
        if (roleHint != null) {
            where.append(" and ul.gradeCode = :roleHint ");
        }

        int idx = 0;
        for (String t : filteredTerms) {
            String p = "t" + idx++;
            where.append(" and (")
                    .append(" lower(u.userId) like :").append(p)
                    .append(" or lower(u.userName) like :").append(p)
                    .append(" or lower(u.email) like :").append(p)
                    .append(" ) ");
        }

        String countJpql = "select count(distinct u.userSeq) from User u left join u.userLevel ul " + where;
        String dataJpql = "select distinct u from User u left join fetch u.userLevel ul " + where
                + " order by u.userSeq desc ";

        var countQuery = em.createQuery(countJpql, Long.class);
        var dataQuery = em.createQuery(dataJpql, User.class);

        if (roleHint != null) {
            countQuery.setParameter("roleHint", (short) roleHint.intValue());
            dataQuery.setParameter("roleHint", (short) roleHint.intValue());
        }

        idx = 0;
        for (String t : filteredTerms) {
            String p = "t" + idx++;
            String like = "%" + t.toLowerCase() + "%";
            countQuery.setParameter(p, like);
            dataQuery.setParameter(p, like);
        }

        long total = countQuery.getSingleResult();
        List<User> rows = dataQuery.setFirstResult(offset).setMaxResults(size).getResultList();
        int totalPages = (total == 0) ? 0 : (int) Math.ceil((double) total / size);

        List<UserListItem> items = new ArrayList<>(rows.size());
        for (User u : rows) {
            int code = (u.getUserLevel() != null && u.getUserLevel().getGradeCode() != null)
                    ? u.getUserLevel().getGradeCode().intValue()
                    : 0;

            String gradeName = (u.getUserLevel() != null && u.getUserLevel().getGradeName() != null)
                    ? u.getUserLevel().getGradeName()
                    : defaultGradeName(code);

            items.add(new UserListItem(
                    u.getUserSeq(),
                    safe(u.getUserId()),
                    safe(u.getUserName()),
                    code,
                    gradeName,
                    safe(u.getEmail()),
                    u.getBirthDate(),
                    (u.getGender() == null ? null : u.getGender().name()),
                    u.getLastLoginAt(),
                    u.getJoinedAt(),
                    u.getGrantedAt(),
                    u.getPasswordChangedAt()
            ));
        }

        return new UserListResult(items, page, size, total, totalPages);
    }

    // ─────────────────────────────────────────────────────────
    // 10-1) 관리자 대시보드 - 로그인 로그 조회(관리자 이상)
    // ─────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public AdminLoginLogListResult listAdminDashboardLoginLogs(AdminLoginLogListQuery query) {
        Objects.requireNonNull(query, "query");
        if (query.actorUserSeq() == null) {
            throw new AuthenticationCredentialsNotFoundException("로그인이 필요합니다.");
        }

        User actor = userRepository.findByUserSeq(query.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(actor) < 1) {
            throw new SecurityException("관리자만 접근할 수 있습니다.");
        }

        int page = Math.max(1, query.page());
        int size = Math.max(1, Math.min(100, query.size()));
        int offset = (page - 1) * size;

        long total = em.createQuery("select count(l.loginLogSeq) from LoginLog l", Long.class)
                .getSingleResult();

        List<LoginLog> rows = em.createQuery(
                        "select l from LoginLog l left join fetch l.user u order by l.attemptedAt desc, l.loginLogSeq desc",
                        LoginLog.class
                )
                .setFirstResult(offset)
                .setMaxResults(size)
                .getResultList();

        int totalPages = (total == 0) ? 0 : (int) Math.ceil((double) total / size);

        List<AdminLoginLogItem> items = new ArrayList<>(rows.size());
        for (LoginLog l : rows) {
            Long userSeq = (l.getUser() == null ? null : l.getUser().getUserSeq());

            items.add(new AdminLoginLogItem(
                    l.getLoginLogSeq(),
                    safe(l.getInputId()),
                    l.getAttemptedAt(),
                    userSeq,
                    Boolean.TRUE.equals(l.getIsSuccess()),
                    safe(l.getIpAddress()),
                    safe(l.getUserAgent())
            ));
        }

        return new AdminLoginLogListResult(items, page, size, total, totalPages);
    }

    // ─────────────────────────────────────────────────────────
    // 11) 관리자 승격 (슈퍼 관리자)
    // ─────────────────────────────────────────────────────────
    public PromoteResult promoteToAdmin(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(operator) != 2) throw new SecurityException("권한이 없습니다.");
        if (operator.getUserSeq().equals(targetUserSeq)) {
            throw new IllegalArgumentException("자기 자신에게는 권한을 부여할 수 없습니다.");
        }

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new IllegalArgumentException("대상 사용자를 찾을 수 없습니다."));
        if (levelCode(target) != 0) {
            throw new IllegalArgumentException("일반 등급(USER)만 승격할 수 있습니다.");
        }

        UserLevel admin = userLevelRepository.findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("ADMIN(1) 등급이 없습니다."));

        LocalDateTime grantedAt = LocalDateTime.now(clock);
        target.setUserLevel(admin);
        target.setGrantedAt(grantedAt);
        userRepository.save(target);

        return new PromoteResult(target.getUserSeq(), operator.getUserSeq(), "ADMIN", grantedAt);
    }

    // ─────────────────────────────────────────────────────────
    // 12) 관리자 강등 (슈퍼 관리자)
    // ─────────────────────────────────────────────────────────
    public DemoteResult demoteToUser(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(operator) != 2) throw new SecurityException("권한이 없습니다.");

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new IllegalArgumentException("잘못된 요청입니다."));
        if (levelCode(target) != 1) {
            throw new IllegalArgumentException("관리자 등급(ADMIN)만 강등할 수 있습니다.");
        }

        UserLevel userLevel = userLevelRepository.findById((short) 0)
                .orElseThrow(() -> new IllegalStateException("USER(0) 등급이 없습니다."));

        LocalDateTime demotedAt = LocalDateTime.now(clock);
        target.setUserLevel(userLevel);
        target.setGrantedAt(null);
        userRepository.save(target);

        return new DemoteResult(target.getUserSeq(), operator.getUserSeq(), demotedAt);
    }

    // ─────────────────────────────────────────────────────────
    // 13) 강제 탈퇴 (슈퍼 관리자)
    // ─────────────────────────────────────────────────────────
    public WithdrawResult withdrawUser(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("로그인이 필요합니다."));
        if (levelCode(operator) != 2) throw new SecurityException("권한이 없습니다.");
        if (operator.getUserSeq().equals(targetUserSeq)) {
            throw new IllegalArgumentException("자기 자신은 탈퇴 처리할 수 없습니다.");
        }

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new NotFoundException("대상 사용자를 찾을 수 없습니다."));

        userRepository.delete(target);

        return new WithdrawResult(targetUserSeq, LocalDateTime.now(clock), operatorUserSeq);
    }

    // ─────────────────────────────────────────────────────────
    // 내부 헬퍼
    // ─────────────────────────────────────────────────────────

    private static void ensureNotBlank(String s, String field) {
        if (s == null || s.trim().isEmpty()) throw new IllegalArgumentException("필수값 누락: " + field);
    }

    private void validateBirthDatePolicy(LocalDate birth) {
        LocalDate today = LocalDate.now(clock);
        if (birth.isAfter(today)) {
            throw new IllegalArgumentException("생년월일은 오늘 이후일 수 없습니다.");
        }

        int age = today.getYear() - birth.getYear()
                - ((today.getMonthValue() * 100 + today.getDayOfMonth())
                < (birth.getMonthValue() * 100 + birth.getDayOfMonth()) ? 1 : 0);

        if (age < 14 && age >= 0) {
            throw new IllegalArgumentException("만 14세 이상만 가입할 수 있습니다.");
        } else if (age < 0 || age >= 120) {
            throw new IllegalArgumentException("생년월일이 올바르지 않습니다.");
        }
    }

    private EmailValidity validateEmailPolicy(String email) {
        if (email == null || email.isBlank()) {
            return EmailValidity.invalid("이메일을 입력해주세요.");
        }

        int at = email.indexOf('@');
        if (at <= 0 || at == email.length() - 1) {
            return EmailValidity.invalid("이메일 형식이 올바르지 않습니다.");
        }

        String domain = email.substring(at + 1).toLowerCase();
        if (!allowedEmailDomains.contains(domain)) {
            String joined = String.join(", ", allowedEmailDomains);
            return EmailValidity.invalid("허용되지 않은 도메인입니다. (" + joined + " 만 사용가능합니다.)");
        }

        return EmailValidity.ok();
    }

    private Gender parseGender(String gender) {
        String g = safe(gender).toUpperCase();
        if ("M".equals(g)) return Gender.M;
        if ("F".equals(g)) return Gender.F;
        throw new IllegalArgumentException("성별은 M 또는 F 이어야 합니다.");
    }

    private String mapRole(User user) {
        int code = levelCode(user);
        return switch (code) {
            case 2 -> "SUPER_ADMIN";
            case 1 -> "ADMIN";
            default -> "USER";
        };
    }

    private int levelCode(User user) {
        if (user == null || user.getUserLevel() == null || user.getUserLevel().getGradeCode() == null) return 0;
        return user.getUserLevel().getGradeCode().intValue();
    }

    private static String defaultGradeName(int code) {
        return switch (code) {
            case 2 -> "SUPER_ADMIN";
            case 1 -> "ADMIN";
            default -> "USER";
        };
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String safe(String s) {
        return (s == null) ? "" : s.trim();
    }

    private static List<String> splitTerms(String q) {
        if (q == null || q.isBlank()) return List.of();
        String[] parts = q.trim().split("\\s+");
        List<String> out = new ArrayList<>(parts.length);
        for (String p : parts) {
            String t = p.trim();
            if (!t.isEmpty()) out.add(t);
        }
        return out;
    }

    private static boolean isRoleWord(String term) {
        if (term == null) return false;
        String t = term.toLowerCase();
        return switch (t) {
            case "admin", "administrator", "관리자",
                    "super", "superadmin", "super-admin", "super_admin",
                    "슈퍼", "슈퍼관리자",
                    "user", "일반", "사용자" -> true;
            default -> false;
        };
    }

    private static boolean isPureRoleCode(String term) {
        return "0".equals(term) || "1".equals(term) || "2".equals(term);
    }

    private static Integer extractRoleHint(List<String> terms) {
        if (terms == null || terms.isEmpty()) return null;

        String full = String.join(" ", terms).toLowerCase();
        if (full.contains("super admin") || full.contains("super-admin") || full.contains("super_admin")
                || full.contains("슈퍼 관리자") || full.contains("슈퍼관리자")) {
            return 2;
        }

        Integer hint = null;
        for (String raw : terms) {
            String t = raw.toLowerCase();

            if (isPureRoleCode(t)) {
                int v = Integer.parseInt(t);
                if (v >= 0 && v <= 2) return v;
            }

            switch (t) {
                case "super", "superadmin", "super-admin", "super_admin", "슈퍼", "슈퍼관리자" -> {
                    return 2;
                }
                case "admin", "administrator", "관리자" -> hint = (hint == null) ? 1 : hint;
                case "user", "일반", "사용자" -> hint = (hint == null) ? 0 : hint;
                default -> {
                }
            }
        }
        return hint;
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

    private void sendAfterCommit(Runnable action) {
        if (action == null) return;

        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            action.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // Precheck Token (JWT 아님)
    // ─────────────────────────────────────────────────────────
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

    private static final String TEMP_PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static String generateTempPassword(int length) {
        int len = Math.max(8, length);
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(TEMP_PW_CHARS.charAt(SECURE_RANDOM.nextInt(TEMP_PW_CHARS.length())));
        }
        return sb.toString();
    }

    private String passwordPolicyError(String pw, String userId) {
        if (pw == null) return "비밀번호를 입력해주세요.";

        String p = pw.trim();
        if (p.length() < 8 || p.length() > 20) {
            return "비밀번호는 8~20자여야 합니다.";
        }

        String uid = safe(userId).toLowerCase();
        if (!uid.isEmpty() && p.toLowerCase().contains(uid)) {
            return "비밀번호에 아이디를 포함할 수 없습니다.";
        }

        boolean hasUpper = p.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = p.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = p.chars().anyMatch(Character::isDigit);
        boolean hasSpecial = p.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));

        int kinds = 0;
        if (hasUpper) kinds++;
        if (hasLower) kinds++;
        if (hasDigit) kinds++;
        if (hasSpecial) kinds++;

        if (kinds < 3) {
            return "비밀번호는 영문 대/소문자, 숫자, 특수문자 중 3종 이상을 포함해야 합니다.";
        }

        return null;
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

    // ─────────────────────────────────────────────────────────
    // Service 내부 응답 모델
    // ─────────────────────────────────────────────────────────

    public record UserIdInfo(boolean valid, String status) {}
    public record IdPrecheckResult(UserIdInfo user_id, String id_check_token, Integer expires_in) {}

    public record EmailInfo(boolean valid, String status) {}
    public record EmailPrecheckResult(EmailInfo email, String email_check_token, Integer expires_in, String message) {}

    public record SignUpResult(Long user_seq, LocalDateTime joined_at) {}

    public record LoginResponse(String access, String role, Long user_seq, String user_id, String message) {}
    public record LoginIssueResult(LoginResponse response, @JsonIgnore String refreshToken) {}

    public record TokenRefreshResponse(String access) {}
    public record TokenRefreshIssueResult(TokenRefreshResponse response, @JsonIgnore String refreshToken) {}

    public record LogoutResult(String message) {}

    public record FindIdCommand(String email, String name) {}
    public record FindIdResult(String user_id) {}

    public record FindPasswordCommand(String userId, String name, String email) {}
    public record FindPasswordResult(String message) {}

    public record ChangePasswordCommand(Long actorUserSeq, String currentPassword, String newPassword, String newPasswordConfirm) {}
    public record ChangePasswordResult(String message, boolean clearRefreshCookie) {}

    public record PromoteResult(Long user_seq, Long acted_seq, String admin_level, LocalDateTime granted_at) {}
    public record DemoteResult(Long user_seq, Long acted_seq, LocalDateTime demoted_at) {}
    public record WithdrawResult(Long user_seq, LocalDateTime deleted_at, Long acted_seq) {}

    public record UserListItem(
            Long user_seq,
            String user_id,
            String user_name,
            int grade_code,
            String grade_name,
            String email,
            LocalDate birth_date,
            String gender,
            LocalDateTime last_login_at,
            LocalDateTime joined_at,
            LocalDateTime granted_at,
            LocalDateTime password_changed_at
    ) {}

    public record UserListResult(List<UserListItem> items, int page, int size, long total_count, int total_pages) {}

    public record AdminLoginLogItem(
            Long login_log_seq,
            String input_id,
            LocalDateTime attempted_at,
            Long user_seq,
            boolean is_success,
            String ip_address,
            String user_agent
    ) {}

    public record AdminLoginLogListResult(
            List<AdminLoginLogItem> items,
            int page,
            int size,
            long total_count,
            int total_pages
    ) {}

    public record AdminLoginLogListQuery(Long actorUserSeq, int page, int size) {}

    public record UserListQuery(Long actorUserSeq, int page, int size, String q) {}

    public record SignUpCommand(
            String userId,
            String email,
            String password,
            String password2,
            String username,
            LocalDate birthDate,
            String gender,
            boolean agreeWhether,
            String idCheckToken,
            String emailCheckToken
    ) {}
}