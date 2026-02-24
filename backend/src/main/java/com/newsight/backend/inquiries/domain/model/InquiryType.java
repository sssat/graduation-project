// backend/src/main/java/com/newsight/backend/inquiries/domain/model/InquiryType.java
package com.newsight.backend.inquiries.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 문의 유형
 * - DB: T_INQUIRY_TYPE
 */
@Entity
@Table(
        name = "T_INQUIRY_TYPE",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UX_T_INQUIRY_TYPE__TYPE_NAME",
                        columnNames = {"TYPE_NAME"}
                )
        },
        indexes = {
                @Index(name = "IX_T_INQUIRY_TYPE__SORT_ORDER", columnList = "SORT_ORDER")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "typeCode")
public class InquiryType {

    @Id
    @Column(name = "TYPE_CODE", length = 20, nullable = false)
    private String typeCode;

    @Column(name = "TYPE_NAME", length = 50, nullable = false)
    private String typeName;

    @Column(name = "SORT_ORDER", nullable = false)
    private int sortOrder;

    @Override
    public String toString() {
        return "[" + typeCode + "] " + typeName;
    }
}