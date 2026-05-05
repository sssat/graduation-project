// backend/src/main/java/com/newsight/backend/analytics/domain/model/PeriodFilter.java
package com.newsight.backend.analytics.domain.model;

/**
 * 기간 필터 (DB ENUM: TODAY, D7, D14, D30)
 * API에서는 주로 D7, D14를 사용하지만 DB는 확장 가능하게 설계되어 있음.
 */
public enum PeriodFilter {
    TODAY,
    D7,
    D14,
    D30
}