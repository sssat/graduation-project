package com.newsight.backend.admin.application.service;

import com.newsight.backend.accounts.domain.model.User;
import com.newsight.backend.accounts.infrastructure.persistence.SpringDataUserRepository;
import com.newsight.backend.admin.domain.model.DailyVisitor;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VisitTrackingService {

    private final EntityManager em;
    private final Clock clock;
    private final SpringDataUserRepository userRepository;

    @Transactional
    public VisitTrackResult trackVisit(
            String clientVisitorId,
            String path,
            String referrer,
            String language,
            String clientTimeZone,
            Integer screenWidth,
            Integer screenHeight,
            String ipAddress,
            String userAgent
    ) {
        LocalDate today = LocalDate.now(clock);
        LocalDateTime now = LocalDateTime.now(clock);
        String visitorKeyHash = sha256Hex(buildVisitorKey(clientVisitorId, ipAddress, userAgent));
        String normalizedPath = normalizePath(path);
        String normalizedReferrer = truncateToNull(referrer, 1024);

        em.createNativeQuery("""
                        INSERT INTO T_DAILY_VISITOR
                            (
                                VISIT_DATE, VISITOR_KEY_HASH, FIRST_VISITED_AT, LAST_VISITED_AT,
                                PAGE_VIEW_COUNT, IP_ADDRESS, USER_AGENT, REFERRER, ACCEPT_LANGUAGE,
                                CLIENT_TIME_ZONE, SCREEN_WIDTH, SCREEN_HEIGHT, FIRST_PATH, LAST_PATH
                            )
                        VALUES
                            (
                                :visitDate, :visitorKeyHash, :now, :now,
                                1, :ipAddress, :userAgent, :referrer, :acceptLanguage,
                                :clientTimeZone, :screenWidth, :screenHeight, :firstPath, :lastPath
                            )
                        ON DUPLICATE KEY UPDATE
                            LAST_VISITED_AT = VALUES(LAST_VISITED_AT),
                            PAGE_VIEW_COUNT = PAGE_VIEW_COUNT + 1,
                            IP_ADDRESS = IFNULL(VALUES(IP_ADDRESS), IP_ADDRESS),
                            USER_AGENT = IFNULL(VALUES(USER_AGENT), USER_AGENT),
                            REFERRER = IFNULL(REFERRER, VALUES(REFERRER)),
                            ACCEPT_LANGUAGE = IFNULL(VALUES(ACCEPT_LANGUAGE), ACCEPT_LANGUAGE),
                            CLIENT_TIME_ZONE = IFNULL(VALUES(CLIENT_TIME_ZONE), CLIENT_TIME_ZONE),
                            SCREEN_WIDTH = IFNULL(VALUES(SCREEN_WIDTH), SCREEN_WIDTH),
                            SCREEN_HEIGHT = IFNULL(VALUES(SCREEN_HEIGHT), SCREEN_HEIGHT),
                            FIRST_PATH = IFNULL(FIRST_PATH, VALUES(FIRST_PATH)),
                            LAST_PATH = VALUES(LAST_PATH)
                        """)
                .setParameter("visitDate", today)
                .setParameter("visitorKeyHash", visitorKeyHash)
                .setParameter("now", now)
                .setParameter("ipAddress", truncateToNull(ipAddress, 45))
                .setParameter("userAgent", truncateToNull(userAgent, 4096))
                .setParameter("referrer", normalizedReferrer)
                .setParameter("acceptLanguage", truncateToNull(language, 255))
                .setParameter("clientTimeZone", truncateToNull(clientTimeZone, 64))
                .setParameter("screenWidth", positiveOrNull(screenWidth))
                .setParameter("screenHeight", positiveOrNull(screenHeight))
                .setParameter("firstPath", normalizedPath)
                .setParameter("lastPath", normalizedPath)
                .executeUpdate();

        return new VisitTrackResult(today.toString(), true);
    }

    @Transactional(readOnly = true)
    public AdminVisitListResult listAdminDashboardVisits(Long actorUserSeq, int page, int size) {
        requireAdmin(actorUserSeq);

        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.min(Math.max(1, size), 100);
        int offset = (normalizedPage - 1) * normalizedSize;

        Long total = em.createQuery("select count(v) from DailyVisitor v", Long.class)
                .getSingleResult();
        long totalCount = total == null ? 0L : total;
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / normalizedSize);

        List<DailyVisitor> rows = em.createQuery(
                        """
                        select v
                        from DailyVisitor v
                        order by v.lastVisitedAt desc, v.visitorDailySeq desc
                        """,
                        DailyVisitor.class
                )
                .setFirstResult(offset)
                .setMaxResults(normalizedSize)
                .getResultList();

        List<AdminVisitItem> items = rows.stream()
                .map(v -> new AdminVisitItem(
                        v.getVisitorDailySeq(),
                        v.getVisitDate(),
                        v.getFirstVisitedAt(),
                        v.getLastVisitedAt(),
                        v.getPageViewCount() == null ? 0 : v.getPageViewCount(),
                        v.getIpAddress(),
                        v.getUserAgent(),
                        v.getReferrer(),
                        v.getAcceptLanguage(),
                        v.getClientTimeZone(),
                        v.getScreenWidth(),
                        v.getScreenHeight(),
                        v.getFirstPath(),
                        v.getLastPath()
                ))
                .toList();

        return new AdminVisitListResult(items, normalizedPage, normalizedSize, totalCount, totalPages);
    }

    private String buildVisitorKey(String clientVisitorId, String ipAddress, String userAgent) {
        String clientKey = safe(clientVisitorId);
        if (!clientKey.isBlank()) {
            return "client:" + clientKey;
        }

        String ip = safe(ipAddress);
        String ua = safe(userAgent);
        if (!ip.isBlank() || !ua.isBlank()) {
            return "request:" + ip + "|" + ua;
        }

        return "unknown";
    }

    private void requireAdmin(Long actorUserSeq) {
        if (actorUserSeq == null) {
            throw new AuthenticationCredentialsNotFoundException("Login is required.");
        }

        User actor = userRepository.findByUserSeq(actorUserSeq)
                .orElseThrow(() -> new AuthenticationCredentialsNotFoundException("Login is required."));

        if (AdminSupport.levelCode(actor) < 1) {
            throw new SecurityException("Only admins can access this resource.");
        }
    }

    private String normalizePath(String path) {
        return truncateToNull(path, 512);
    }

    private String truncateToNull(String value, int maxLength) {
        value = safe(value);
        if (value.isBlank()) return null;
        if (value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    private Integer positiveOrNull(Integer value) {
        if (value == null || value <= 0) return null;
        return value;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    public record VisitTrackResult(
            String visitDate,
            boolean tracked
    ) {}

    public record AdminVisitItem(
            Long visitorDailySeq,
            LocalDate visitDate,
            LocalDateTime firstVisitedAt,
            LocalDateTime lastVisitedAt,
            int pageViewCount,
            String ipAddress,
            String userAgent,
            String referrer,
            String acceptLanguage,
            String clientTimeZone,
            Integer screenWidth,
            Integer screenHeight,
            String firstPath,
            String lastPath
    ) {}

    public record AdminVisitListResult(
            List<AdminVisitItem> items,
            int page,
            int size,
            long totalCount,
            int totalPages
    ) {}
}
