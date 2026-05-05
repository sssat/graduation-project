// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeWordcloudItem.java
package com.newsight.backend.analytics.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_WORDCLOUD_ITEM",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_WCI__WC_RANK",
                        columnNames = {"WC_SEQ", "RANK_NO"}
                ),
                @UniqueConstraint(
                        name = "UK_T_WCI__WC_WORD",
                        columnNames = {"WC_SEQ", "WORD_TEXT"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "wcItemSeq")
@ToString(of = {"wcItemSeq", "wcSeq", "rankNo", "wordText", "weight"})
public class AnalyzeWordcloudItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "WC_ITEM_SEQ", nullable = false)
    private Long wcItemSeq;

    @Column(name = "WC_SEQ", nullable = false)
    private Long wcSeq;

    @Column(name = "RANK_NO", nullable = false)
    private Integer rankNo;

    @Column(name = "WORD_TEXT", nullable = false, length = 80)
    private String wordText;

    @Column(name = "WEIGHT", nullable = false, precision = 10, scale = 4)
    private BigDecimal weight;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "WC_SEQ", insertable = false, updatable = false)
    private AnalyzeWordcloud wordcloud;
}