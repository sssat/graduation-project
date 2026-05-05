// src/main/java/com/newsight/backend/accounts/domain/model/LoginLog.java
package com.newsight.backend.accounts.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "T_LOGIN_LOG",
        indexes = {
                @Index(name = "IX_T_LOGIN_LOG__ATTEMPTED_AT", columnList = "ATTEMPTED_AT"),
                @Index(name = "IX_T_LOGIN_LOG__INPUT_ID", columnList = "INPUT_ID"),
                @Index(name = "IX_T_LOGIN_LOG__USER_SEQ", columnList = "USER_SEQ")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "loginLogSeq")
public class LoginLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "LOGIN_LOG_SEQ", nullable = false)
    private Long loginLogSeq;

    @Column(name = "INPUT_ID", nullable = false, length = 50)
    private String inputId;

    @Column(name = "ATTEMPTED_AT", nullable = false, updatable = false)
    private LocalDateTime attemptedAt;

    @Column(name = "IS_SUCCESS", nullable = false)
    private Boolean isSuccess;

    @Column(name = "IP_ADDRESS", nullable = false, length = 45)
    private String ipAddress;

    // DDL: USER_SEQ NULL, ON DELETE SET NULL
    @ManyToOne(fetch = FetchType.LAZY, optional = true)
    @JoinColumn(
            name = "USER_SEQ",
            foreignKey = @ForeignKey(name = "FK_T_LOGIN_LOG__USER")
    )
    private User user;

    @Lob
    @Column(name = "USER_AGENT")
    private String userAgent;

    @PrePersist
    void prePersist() {
        if (this.attemptedAt == null) {
            this.attemptedAt = LocalDateTime.now();
        }
    }

    @Override
    public String toString() {
        return "[" + loginLogSeq + "] inputId=" + inputId + ", success=" + isSuccess + ", ip=" + ipAddress;
    }
}
