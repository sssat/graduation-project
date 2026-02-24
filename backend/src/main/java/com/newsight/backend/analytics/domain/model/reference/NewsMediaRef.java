// backend/src/main/java/com/newsight/backend/analytics/domain/model/reference/NewsMediaRef.java
package com.newsight.backend.analytics.domain.model.reference;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "T_NEWS_MEDIA")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "mediaCode")
@ToString(of = {"mediaCode", "mediaName"})
public class NewsMediaRef {

    @Id
    @Column(name = "MEDIA_CODE", nullable = false)
    private Integer mediaCode;

    @Column(name = "MEDIA_NAME", nullable = false, length = 50)
    private String mediaName;
}