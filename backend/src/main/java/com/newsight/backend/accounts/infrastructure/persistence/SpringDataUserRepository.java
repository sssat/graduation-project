// src/main/java/com/newsight/backend/accounts/infrastructure/persistence/SpringDataUserRepository.java

// [SpringDataUserRepository.java]
// User 엔티티(T_USER 테이블)를 DB에서 조회/저장하기 위한 Spring Data JPA용 Repository 인터페이스
// 여기서 시그니처로 선언한 함수들은 서비스 레이어에서 사용한다.

// [Spring Data JPA] 
// JPA를 더 쉽게 쓰게 해주는 편의 레이어
// 그래서 SpringDataUserRepository 같은 인터페이스를 만들어두면, Spring Data JPA가 구현체를 자동 생성하고
// 그 내부에서 Hibernate(JPA 구현체)가 SQL을 실행하는 구조이다.
// 또한 여기서 시그니처로 선언한 함수들은 내가 직접 구현하는게 아니라 Spring Data JPA가 자동으로 만들어서 실행한다.

package com.newsight.backend.accounts.infrastructure.persistence;

import com.newsight.backend.accounts.domain.model.User;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface SpringDataUserRepository extends JpaRepository<User, Long> {

    // 1. 로그인 아이디(USER_ID)로 사용자 1명을 조회 (UserLevel까지 함께 로딩)
    @EntityGraph(attributePaths = "userLevel")
    Optional<User> findByUserId(String userId);

    // 2. 이메일(EMAIL)로 사용자 1명을 조회 (UserLevel까지 함께 로딩)
    @EntityGraph(attributePaths = "userLevel")
    Optional<User> findByEmail(String email);

    // 3. USER_ID가 이미 존재하는지 존재 여부만 확인
    boolean existsByUserId(String userId);

    // 4. EMAIL이 이미 존재하는지 존재 여부만 확인
    boolean existsByEmail(String email);

    // 5. PK(USER_SEQ)로 유저를 조회하면서, 연관된 등급(UserLevel)을 같이 로딩
    @EntityGraph(attributePaths = "userLevel")
    Optional<User> findByUserSeq(Long userSeq);

    // 6. 특정 유저의 LAST_LOGIN_AT 컬럼만 단일 UPDATE 쿼리로 빠르게 갱신
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update User u set u.lastLoginAt = :ts where u.userSeq = :userSeq")
    int updateLastLoginAt(@Param("userSeq") Long userSeq, @Param("ts") LocalDateTime ts);

    // 7. 특정 기간(시각) 내 가입자 수 집계 (start 포함, end 미포함)
    long countByJoinedAtGreaterThanEqualAndJoinedAtLessThan(LocalDateTime startInclusive, LocalDateTime endExclusive);
}