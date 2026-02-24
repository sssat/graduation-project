// backend/src/main/java/com/newsight/backend/analytics/domain/model/AnalyzeCoMentionEdge.java
package com.newsight.backend.analytics.domain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_CO_MENTION_EDGE",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_EDGE__GRAPH_FROM_TO",
                        columnNames = {"GRAPH_SEQ", "FROM_NODE_SEQ", "TO_NODE_SEQ"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "edgeSeq")
@ToString(of = {"edgeSeq", "graphSeq", "fromNodeSeq", "toNodeSeq", "coMentionCount"})
public class AnalyzeCoMentionEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "EDGE_SEQ", nullable = false)
    private Long edgeSeq;

    @Column(name = "GRAPH_SEQ", nullable = false)
    private Long graphSeq;

    @Column(name = "FROM_NODE_SEQ", nullable = false)
    private Long fromNodeSeq;

    @Column(name = "TO_NODE_SEQ", nullable = false)
    private Long toNodeSeq;

    @Column(name = "CO_MENTION_COUNT", nullable = false)
    private Integer coMentionCount;

    @Column(name = "EDGE_WEIGHT", nullable = false, precision = 10, scale = 4)
    private BigDecimal edgeWeight;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 읽기 전용 FK 연관 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "GRAPH_SEQ", insertable = false, updatable = false)
    private AnalyzeCoMentionGraph graph;

    /** 읽기 전용 FK 연관 (시작 노드) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "FROM_NODE_SEQ", insertable = false, updatable = false)
    private AnalyzeCoMentionNode fromNode;

    /** 읽기 전용 FK 연관 (도착 노드) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "TO_NODE_SEQ", insertable = false, updatable = false)
    private AnalyzeCoMentionNode toNode;
}