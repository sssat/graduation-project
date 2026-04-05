package com.newsight.backend.analytics.domain.model;

import com.newsight.backend.analytics.domain.model.reference.TrendKeywordMasterRef;
import com.newsight.backend.analytics.domain.model.reference.TrendRunRef;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(
        name = "T_ANALYZE_SEARCH_TIMELINE",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_T_ASTT__RUN_KEYWORD_DATE_GSP",
                        columnNames = {"TREND_RUN_SEQ", "KEYWORD_SEQ", "OBSERVED_DATE", "GEO_CODE", "SEARCH_PROPERTY"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "timelineSeq")
@ToString(of = {"timelineSeq", "keywordSeq", "observedDate", "interestScore"})
public class AnalyzeSearchTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TIMELINE_SEQ", nullable = false)
    private Long timelineSeq;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "OBSERVED_DATE", nullable = false)
    private LocalDate observedDate;

    @Column(name = "GEO_CODE", nullable = false, length = 10)
    private String geoCode;

    @Column(name = "SEARCH_PROPERTY", nullable = false, length = 20)
    private String searchProperty;

    @Column(name = "TIMEFRAME_LABEL", nullable = false, length = 32)
    private String timeframeLabel;

    @Column(name = "DATA_SOURCE", nullable = false, length = 32)
    private String dataSource;

    @Column(name = "INTEREST_SCORE", nullable = false)
    private Integer interestScore;

    @Column(name = "IS_PARTIAL", nullable = false)
    private Boolean isPartial;

    @Column(name = "FETCHED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime fetchedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "KEYWORD_SEQ", insertable = false, updatable = false)
    private TrendKeywordMasterRef keyword;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "TREND_RUN_SEQ", insertable = false, updatable = false)
    private TrendRunRef trendRun;
}
