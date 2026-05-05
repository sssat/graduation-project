// backend/src/main/java/com/newsight/backend/analytics/domain/model/reference/NewsArticleRef.java
package com.newsight.backend.analytics.domain.model.reference;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "T_NEWS_ARTICLE")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "articleSeq")
@ToString(of = {"articleSeq", "trendRunSeq", "keywordSeq", "mediaCode"})
public class NewsArticleRef {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ARTICLE_SEQ", nullable = false)
    private Long articleSeq;

    @Column(name = "SOURCE_URL", nullable = false, length = 2048)
    private String sourceUrl;

    @Column(name = "URL_HASH", nullable = false, length = 64)
    private String urlHash;

    @Column(name = "TITLE", nullable = false, length = 300)
    private String title;

    @Column(name = "PUBLISHED_AT")
    private LocalDateTime publishedAt;

    @Column(name = "MEDIA_CODE", nullable = false)
    private Integer mediaCode;

    @Column(name = "KEYWORD_SEQ", nullable = false)
    private Long keywordSeq;

    @Column(name = "TREND_RUN_SEQ", nullable = false)
    private Long trendRunSeq;

    @Column(name = "CREATED_AT", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}