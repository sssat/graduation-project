// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeAiSummaryArticle.java
package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.NewsArticleRef;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_AI_SUMMARY_ARTICLE",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_KAIS_ART__SUMMARY_ARTICLE",
                        columnNames = {"SUMMARY_SEQ", "ARTICLE_SEQ"}
                ),
                @UniqueConstraint(
                        name = "UK_T_KAIS_ART__SUMMARY_ORDER",
                        columnNames = {"SUMMARY_SEQ", "INPUT_ORDER"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "linkSeq")
@ToString(of = {"linkSeq", "summarySeq", "articleSeq", "inputOrder"})
public class AnalyzeAiSummaryArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "LINK_SEQ", nullable = false)
    private Long linkSeq;

    @Column(name = "SUMMARY_SEQ", nullable = false)
    private Long summarySeq;

    @Column(name = "ARTICLE_SEQ", nullable = false)
    private Long articleSeq;

    @Column(name = "INPUT_ORDER", nullable = false)
    private Integer inputOrder;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "SUMMARY_SEQ", insertable = false, updatable = false)
    private AnalyzeAiSummary summary;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ARTICLE_SEQ", insertable = false, updatable = false)
    private NewsArticleRef article;
}