// src/main/java/com/newsignt/backend/accounts/domain/model/User.java

// [User.java]
// DB의 T_USER 테이블 한 행(row)을 자바 객체로 표현해서, 
// JPA(Hibernate)가 "유저 데이터 저장/조회/수정"을 할 수 있게 해주는 도메인 모델
// 다만, 현재 User 엔티티엔 비즈니스 로직이 거의 없는 상태이고, 
// 단지 DB 스키마를 코드로 옮긴 영속(persistence) 모델(DB에 저장될 수 있게(영속화될 수 있게) 설계된 모델)에 가깝다.
// 또한 이 파일(User 엔티티)은 ORM 자체가 아니라,
// ORM(JPA/Hibernate)이 DB 테이블(T_USER)과 매핑하기 위해 사용하는 "엔티티(매핑 정의)"이다.

// [JPA(Hibernate)]
// 자바 객체(User 같은 엔티티) <-> DB 테이블(T_USER 같은 것)을 자동으로 연결해서, 
// SQL을 직접 많이 안 써도 DB 저장/조회가 되게 해주는 기술

// [JPA vs Hibernate]
// JPA: 규칙(표준)
// Hibernate: 그 규칙을 실제로 실행하는 구현체
// Hibernate는 JPA를 실제로 구현한 대표 엔진(라이브러리) 이라서
// 스프링 부트에서 "JPA 쓴다" 하면 대부분 내부적으로 Hibernate가 동작함


package com.newsight.backend.accounts.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "T_USER",
        uniqueConstraints = {
                @UniqueConstraint(name = "UK_T_USER__USER_ID", columnNames = {"USER_ID"}),
                @UniqueConstraint(name = "UK_T_USER__EMAIL", columnNames = {"EMAIL"})
        },
        indexes = {
                @Index(name = "IX_T_USER__GRADE", columnList = "GRADE_CODE"),
                @Index(name = "IX_T_USER__JOINED_AT", columnList = "JOINED_AT")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(of = "userSeq")
public class User {

    public enum Gender {
        M, F
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "USER_SEQ", nullable = false)
    private Long userSeq;

    @Column(name = "USER_NAME", nullable = false, length = 100)
    private String userName;

    @Column(name = "USER_ID", nullable = false, length = 50)
    private String userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "GRADE_CODE",
            nullable = false,
            foreignKey = @ForeignKey(name = "FK_T_USER__GRADE")
    )
    private UserLevel userLevel;

    @Column(name = "EMAIL", nullable = false, length = 150)
    private String email;

    // DDL: CHAR(1) ('M'/'F')
    @Enumerated(EnumType.STRING)
    @Column(name = "GENDER", nullable = false, length = 1, columnDefinition = "CHAR(1)")
    private Gender gender;

    @Column(name = "BIRTH_DATE", nullable = false)
    private LocalDate birthDate;

    @Column(name = "LAST_LOGIN_AT")
    private LocalDateTime lastLoginAt;

    @Column(name = "JOINED_AT", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @Column(name = "GRANTED_AT")
    private LocalDateTime grantedAt;

    @Column(name = "PASSWORD_CHANGED_AT")
    private LocalDateTime passwordChangedAt;

    @Column(name = "PASSWORD_HASH", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "REFRESH_TOKEN_VERSION", nullable = false)
    @Builder.Default
    private Integer refreshTokenVersion = 0;

    @PrePersist
    void prePersist() {
        if (this.joinedAt == null) {
            this.joinedAt = LocalDateTime.now();
        }
        if (this.refreshTokenVersion == null) {
            this.refreshTokenVersion = 0;
        }
    }

    public int currentRefreshTokenVersion() {
        return refreshTokenVersion == null ? 0 : refreshTokenVersion;
    }

    public void rotateRefreshTokenVersion() {
        this.refreshTokenVersion = currentRefreshTokenVersion() + 1;
    }

    @Override
    public String toString() {
        return "[" + userSeq + "] " + userId + " (" + userName + ")";
    }
}
