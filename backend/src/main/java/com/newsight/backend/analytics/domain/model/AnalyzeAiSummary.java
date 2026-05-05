// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeAiSummary.java
package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_AI_SUMMARY",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_KAIS__RUN_KEYWORD",
                        columnNames = {"TREND_RUN_SEQ", "KEYWORD_SEQ"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "summarySeq")
@ToString(of = {"summarySeq", "trendRunSeq", "keywordSeq"})
public class AnalyzeAiSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SUMMARY_SEQ", nullable = false)
    private Long summarySeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Lob
    @Column(name = "SUMMARY_TEXT", nullable = false)
    private String summaryText;

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

    /** 요약에 사용된 기사 링크들 */
    @Builder.Default
    @OneToMany(fetch = FetchType.LAZY, mappedBy = "summary")
    private List<AnalyzeAiSummaryArticle> articles = new ArrayList<>();
}