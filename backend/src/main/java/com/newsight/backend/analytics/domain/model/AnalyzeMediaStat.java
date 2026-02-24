// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeMediaStat.java
package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.NewsMediaRef;
import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_MEDIA_STAT",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_KMS__RUN_KMP",
                        columnNames = {"TREND_RUN_SEQ", "KEYWORD_SEQ", "MEDIA_CODE", "PERIOD_FILTER"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "statSeq")
@ToString(of = {"statSeq", "trendRunSeq", "keywordSeq", "mediaCode", "periodFilter", "articleCount"})
public class AnalyzeMediaStat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "STAT_SEQ", nullable = false)
    private Long statSeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Column(name = "MEDIA_CODE", nullable = false)
    private Integer mediaCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "PERIOD_FILTER", nullable = false)
    private PeriodFilter periodFilter;

    @Column(name = "ARTICLE_COUNT", nullable = false)
    private Integer articleCount;

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