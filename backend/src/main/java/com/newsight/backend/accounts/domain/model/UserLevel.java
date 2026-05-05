// src/main/java/com/newsight/backend/accounts/domain/model/UserLevel.java
package com.newsight.backend.accounts.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "T_USER_LEVEL")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "gradeCode")
public class UserLevel {

    @Id
    @Column(name = "GRADE_CODE", nullable = false)
    private Short gradeCode;

    @Column(name = "GRADE_NAME", nullable = false, length = 20)
    private String gradeName;

    @Override
    public String toString() {
        return "[등급 " + gradeCode + "] " + gradeName;
    }
}
