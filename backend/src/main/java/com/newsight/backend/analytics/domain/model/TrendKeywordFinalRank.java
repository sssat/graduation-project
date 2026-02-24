// backend/src/main/java/com/newsight/backend/analytics/domain/model/TrendKeywordFinalRank.java
package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_TREND_KEYWORD_FINAL_RANK",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_KFR__RUN_KEYWORD_PERIOD",
                        columnNames = {"TREND_RUN_SEQ", "KEYWORD_SEQ", "PERIOD_FILTER"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "finalRankSeq")
@ToString(of = {"finalRankSeq", "trendRunSeq", "keywordSeq", "periodFilter", "finalRank"})
public class TrendKeywordFinalRank {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "FINAL_RANK_SEQ", nullable = false)
    private Long finalRankSeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Enumerated(EnumType.STRING)
    @Column(name = "PERIOD_FILTER", nullable = false)
    private PeriodFilter periodFilter;

    @Column(name = "ARTICLE_COUNT", nullable = false)
    private Integer articleCount;

    @Column(name = "FINAL_RANK", nullable = false)
    private Integer finalRank;

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
}