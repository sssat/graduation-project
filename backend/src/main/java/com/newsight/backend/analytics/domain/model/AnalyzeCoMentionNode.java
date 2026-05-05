// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeCoMentionNode.java
package com.newsight.backend.analytics.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_CO_MENTION_NODE",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_NODE__GRAPH_ENTITY",
                        columnNames = {"GRAPH_SEQ", "ENTITY_NAME"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "nodeSeq")
@ToString(of = {"nodeSeq", "graphSeq", "entityName", "entityType"})
public class AnalyzeCoMentionNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "NODE_SEQ", nullable = false)
    private Long nodeSeq;

    @Column(name = "GRAPH_SEQ", nullable = false)
    private Long graphSeq;

    @Column(name = "ENTITY_NAME", nullable = false, length = 120)
    private String entityName;

    @Enumerated(EnumType.STRING)
    @Column(name = "ENTITY_TYPE", nullable = false)
    private CoMentionEntityType entityType;

    @Column(name = "NODE_WEIGHT", nullable = false, precision = 10, scale = 4)
    private BigDecimal nodeWeight;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "GRAPH_SEQ", insertable = false, updatable = false)
    private AnalyzeCoMentionGraph graph;
}