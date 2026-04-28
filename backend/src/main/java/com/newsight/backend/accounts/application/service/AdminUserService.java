package com.newsight.backend.accounts.application.service;

import com.newsight.backend.accounts.domain.model.LoginLog;
import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.domain.model.UserLevel;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserLevelRepository;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.common.exception.NotFoundException;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
class AdminUserService {

    private final SpringDataUserRepository userRepository;
    private final SpringDataUserLevelRepository userLevelRepository;
    private final EntityManager em;
    private final Clock clock;

    @Transactional(readOnly = true)
    AccountsService.UserListResult listUsers(AccountsService.UserListQuery query) {
        Objects.requireNonNull(query, "query");
        if (query.actorUserSeq() == null) throw new AuthenticationCredentialsNotFoundException("Login is required.");

        User actor = userRepository.findByUserSeq(query.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));
        if (AccountSupport.levelCode(actor) != 2) throw new SecurityException("Only super admins can access this resource.");

        int page = Math.max(1, query.page());
        int size = Math.max(1, Math.min(100, query.size()));
        int offset = (page - 1) * size;

        List<String> filteredTerms = AccountSupport.splitTerms(AccountSupport.safe(query.q()));
        StringBuilder where = new StringBuilder(" where 1=1 ");

        for (int i = 0; i < filteredTerms.size(); i++) {
            String p = "t" + i;
            where.append(" and (")
                    .append(" lower(u.userId) like :").append(p)
                    .append(" or lower(u.userName) like :").append(p)
                    .append(" ) ");
        }

        String countJpql = "select count(distinct u.userSeq) from User u left join u.userLevel ul " + where;
        String dataJpql = "select distinct u from User u left join fetch u.userLevel ul " + where
                + " order by u.userSeq desc ";

        var countQuery = em.createQuery(countJpql, Long.class);
        var dataQuery = em.createQuery(dataJpql, User.class);

        for (int i = 0; i < filteredTerms.size(); i++) {
            String p = "t" + i;
            String like = "%" + filteredTerms.get(i).toLowerCase() + "%";
            countQuery.setParameter(p, like);
            dataQuery.setParameter(p, like);
        }

        long total = countQuery.getSingleResult();
        List<User> rows = dataQuery.setFirstResult(offset).setMaxResults(size).getResultList();
        int totalPages = (total == 0) ? 0 : (int) Math.ceil((double) total / size);

        List<AccountsService.UserListItem> items = new ArrayList<>(rows.size());
        for (User u : rows) {
            int code = (u.getUserLevel() != null && u.getUserLevel().getGradeCode() != null)
                    ? u.getUserLevel().getGradeCode().intValue()
                    : 0;

            String gradeName = (u.getUserLevel() != null && u.getUserLevel().getGradeName() != null)
                    ? u.getUserLevel().getGradeName()
                    : AccountSupport.defaultGradeName(code);

            items.add(new AccountsService.UserListItem(
                    u.getUserSeq(),
                    AccountSupport.safe(u.getUserId()),
                    AccountSupport.safe(u.getUserName()),
                    code,
                    gradeName,
                    AccountSupport.safe(u.getEmail()),
                    u.getBirthDate(),
                    (u.getGender() == null ? null : u.getGender().name()),
                    u.getLastLoginAt(),
                    u.getJoinedAt(),
                    u.getGrantedAt(),
                    u.getPasswordChangedAt()
            ));
        }

        return new AccountsService.UserListResult(items, page, size, total, totalPages);
    }

    @Transactional(readOnly = true)
    AccountsService.AdminLoginLogListResult listAdminDashboardLoginLogs(AccountsService.AdminLoginLogListQuery query) {
        Objects.requireNonNull(query, "query");
        if (query.actorUserSeq() == null) {
            throw new AuthenticationCredentialsNotFoundException("Login is required.");
        }

        User actor = userRepository.findByUserSeq(query.actorUserSeq())
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));
        if (AccountSupport.levelCode(actor) < 1) {
            throw new SecurityException("Only admins can access this resource.");
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

        List<AccountsService.AdminLoginLogItem> items = new ArrayList<>(rows.size());
        for (LoginLog l : rows) {
            Long userSeq = (l.getUser() == null ? null : l.getUser().getUserSeq());

            items.add(new AccountsService.AdminLoginLogItem(
                    l.getLoginLogSeq(),
                    AccountSupport.safe(l.getInputId()),
                    l.getAttemptedAt(),
                    userSeq,
                    Boolean.TRUE.equals(l.getIsSuccess()),
                    AccountSupport.safe(l.getIpAddress()),
                    AccountSupport.safe(l.getUserAgent())
            ));
        }

        return new AccountsService.AdminLoginLogListResult(items, page, size, total, totalPages);
    }

    AccountsService.PromoteResult promoteToAdmin(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));
        if (AccountSupport.levelCode(operator) != 2) throw new SecurityException("Permission denied.");
        if (operator.getUserSeq().equals(targetUserSeq)) {
            throw new IllegalArgumentException("Cannot promote yourself.");
        }

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found."));
        if (AccountSupport.levelCode(target) != 0) {
            throw new IllegalArgumentException("Only USER grade accounts can be promoted.");
        }

        UserLevel admin = userLevelRepository.findById((short) 1)
                .orElseThrow(() -> new IllegalStateException("ADMIN(1) level is missing."));

        LocalDateTime grantedAt = LocalDateTime.now(clock);
        target.setUserLevel(admin);
        target.setGrantedAt(grantedAt);
        userRepository.save(target);

        return new AccountsService.PromoteResult(target.getUserSeq(), operator.getUserSeq(), "ADMIN", grantedAt);
    }

    AccountsService.DemoteResult demoteToUser(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));
        if (AccountSupport.levelCode(operator) != 2) throw new SecurityException("Permission denied.");

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new IllegalArgumentException("Invalid request."));
        if (AccountSupport.levelCode(target) != 1) {
            throw new IllegalArgumentException("Only ADMIN grade accounts can be demoted.");
        }

        UserLevel userLevel = userLevelRepository.findById((short) 0)
                .orElseThrow(() -> new IllegalStateException("USER(0) level is missing."));

        LocalDateTime demotedAt = LocalDateTime.now(clock);
        target.setUserLevel(userLevel);
        target.setGrantedAt(null);
        userRepository.save(target);

        return new AccountsService.DemoteResult(target.getUserSeq(), operator.getUserSeq(), demotedAt);
    }

    AccountsService.WithdrawResult withdrawUser(Long targetUserSeq, Long operatorUserSeq) {
        Objects.requireNonNull(targetUserSeq, "targetUserSeq");
        Objects.requireNonNull(operatorUserSeq, "operatorUserSeq");

        User operator = userRepository.findByUserSeq(operatorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));
        if (AccountSupport.levelCode(operator) != 2) throw new SecurityException("Permission denied.");
        if (operator.getUserSeq().equals(targetUserSeq)) {
            throw new IllegalArgumentException("Cannot withdraw yourself.");
        }

        User target = userRepository.findByUserSeq(targetUserSeq)
                .orElseThrow(() -> new NotFoundException("Target user not found."));

        userRepository.delete(target);

        return new AccountsService.WithdrawResult(targetUserSeq, LocalDateTime.now(clock), operatorUserSeq);
    }
}
