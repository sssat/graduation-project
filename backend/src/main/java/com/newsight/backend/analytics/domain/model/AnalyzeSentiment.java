// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeSentiment.java
package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.NewsMediaRef;
import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_SENTIMENT",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_KSENT__RUN_KMP",
                        columnNames = {"TREND_RUN_SEQ", "KEYWORD_SEQ", "MEDIA_CODE", "PERIOD_FILTER"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "sentimentSeq")
@ToString(of = {"sentimentSeq", "trendRunSeq", "keywordSeq", "mediaCode", "periodFilter"})
public class AnalyzeSentiment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SENTIMENT_SEQ", nullable = false)
    private Long sentimentSeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Column(name = "MEDIA_CODE", nullable = false)
    private Integer mediaCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "PERIOD_FILTER", nullable = false)
    private PeriodFilter periodFilter;

    @Column(name = "POSITIVE_PCT_TITLE", nullable = false, precision = 5, scale = 2)
    private BigDecimal positivePctTitle;

    @Column(name = "NEUTRAL_PCT_TITLE", nullable = false, precision = 5, scale = 2)
    private BigDecimal neutralPctTitle;

    @Column(name = "NEGATIVE_PCT_TITLE", nullable = false, precision = 5, scale = 2)
    private BigDecimal negativePctTitle;

    @Column(name = "POSITIVE_PCT_CONTENT", nullable = false, precision = 5, scale = 2)
    private BigDecimal positivePctContent;

    @Column(name = "NEUTRAL_PCT_CONTENT", nullable = false, precision = 5, scale = 2)
    private BigDecimal neutralPctContent;

    @Column(name = "NEGATIVE_PCT_CONTENT", nullable = false, precision = 5, scale = 2)
    private BigDecimal negativePctContent;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "TREND_RUN_SEQ", insertable = false, updatable = false)
    private TrendRunRef trendRun;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "KEYWORD_SEQ", insertable = false, updatable = false)
    private TrendKeywordMasterRef keyword;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "MEDIA_CODE", insertable = false, updatable = false)
    private NewsMediaRef media;
}