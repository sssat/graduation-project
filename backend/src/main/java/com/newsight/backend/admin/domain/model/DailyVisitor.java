package com.newsight.backend.admin.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
        name = "T_DAILY_VISITOR",
        uniqueConstraints = {
                @UniqueConstraint(name = "UK_T_DAILY_VISITOR__DATE_HASH", columnNames = {"VISIT_DATE", "VISITOR_KEY_HASH"})
        },
        indexes = {
                @Index(name = "IX_T_DAILY_VISITOR__VISIT_DATE", columnList = "VISIT_DATE"),
                @Index(name = "IX_T_DAILY_VISITOR__LAST_VISITED_AT", columnList = "LAST_VISITED_AT")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "visitorDailySeq")
public class DailyVisitor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "VISITOR_DAILY_SEQ", nullable = false)
    private Long visitorDailySeq;

    @Column(name = "VISIT_DATE", nullable = false)
    private LocalDate visitDate;

    @Column(name = "VISITOR_KEY_HASH", nullable = false, length = 64)
    private String visitorKeyHash;

    @Column(name = "FIRST_VISITED_AT", nullable = false, updatable = false)
    private LocalDateTime firstVisitedAt;

    @Column(name = "LAST_VISITED_AT", nullable = false)
    private LocalDateTime lastVisitedAt;

    @Column(name = "PAGE_VIEW_COUNT", nullable = false)
    private Integer pageViewCount;

    @Column(name = "IP_ADDRESS", length = 45)
    private String ipAddress;

    @Lob
    @Column(name = "USER_AGENT")
    private String userAgent;

    @Column(name = "REFERRER", length = 1024)
    private String referrer;

    @Column(name = "ACCEPT_LANGUAGE", length = 255)
    private String acceptLanguage;

    @Column(name = "CLIENT_TIME_ZONE", length = 64)
    private String clientTimeZone;

    @Column(name = "SCREEN_WIDTH")
    private Integer screenWidth;

    @Column(name = "SCREEN_HEIGHT")
    private Integer screenHeight;

    @Column(name = "FIRST_PATH", length = 512)
    private String firstPath;

    @Column(name = "LAST_PATH", length = 512)
    private String lastPath;
}
