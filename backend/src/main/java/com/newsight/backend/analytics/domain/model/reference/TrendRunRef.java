// backend/src/main/java/com/newsight/backend/analytics/domain/model/reference/TrendRunRef.java
package com.newsight.backend.analytics.domain.model.reference;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "T_TREND_RUN")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "trendRunSeq")
@ToString(of = {"trendRunSeq", "baseDate", "runAt", "published", "publishedAt"})
public class TrendRunRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "BASE_DATE", nullable = false)
    private LocalDate baseDate;

    @Column(name = "RUN_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime runAt;

    @Column(name = "TOP_N")
    private Integer topN;

    @Column(name = "IS_PUBLISHED", nullable = false)
    private Boolean published;

    @Column(name = "PUBLISHED_AT")
    private LocalDateTime publishedAt;
}
