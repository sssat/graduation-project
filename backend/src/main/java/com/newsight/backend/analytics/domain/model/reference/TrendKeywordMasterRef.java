// backend/src/main/java/com/newsight/backend/analytics/domain/model/reference/TrendKeywordMasterRef.java
package com.newsight.backend.analytics.domain.model.reference;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "T_TREND_KEYWORD_MASTER")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "keywordSeq")
@ToString(of = {"keywordSeq", "keywordName"})
public class TrendKeywordMasterRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Column(name = "KEYWORD_NAME", nullable = false, length = 50)
    private String keywordName;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}g