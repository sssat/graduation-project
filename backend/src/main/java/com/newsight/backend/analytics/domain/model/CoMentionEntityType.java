// backend/src/main/java/com/newsight/backend/analytics/domain/model/CoMentionEntityType.java
package com.newsight.backend.analytics.domain.model;

/**
 * 공동 언급 네트워크 엔티티 타입 (DB ENUM: PERSON, ORG, LOCATION, ETC)
 */
public enum CoMentionEntityType {
    PERSON,
    ORG,
    LOCATION,
    ETC
}