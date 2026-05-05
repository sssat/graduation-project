// src/main/java/com/newsight/backend/accounts/infrastructure/persistence/SpringDataLoginLogRepository.java

package com.newsight.backend.accounts.infrastructure.persistence;

import com.newsight.backend.accounts.domain.model.LoginLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataLoginLogRepository extends JpaRepository<LoginLog, Long> {

    // 1. 특정 입력 아이디(INPUT_ID)로 최근 로그인 시도 20건 조회
    List<LoginLog> findTop20ByInputIdOrderByAttemptedAtDesc(String inputId);

    // 2. 특정 사용자(PK: USER_SEQ) 기준으로 최근 로그인 시도 20건 조회
    List<LoginLog> findTop20ByUser_UserSeqOrderByAttemptedAtDesc(Long userSeq);
}
