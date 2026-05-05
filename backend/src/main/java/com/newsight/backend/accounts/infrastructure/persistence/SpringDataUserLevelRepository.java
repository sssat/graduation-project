// src/main/java/com/newsight/backend/accounts/infrastructure/persistence/SpringDataUserLevelRepository.java

package com.newsight.backend.accounts.infrastructure.persistence;

import com.newsight.backend.accounts.domain.model.UserLevel;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataUserLevelRepository extends JpaRepository<UserLevel, Short> {
    // extends JpaRepository<UserLevel, Short> 하는 순간
    // 상속으로 findById, save, deleteById, existsById, findAll 같은 기본 CRUD 메서드가 자동으로 제공된다.
    // 따라서 기본 CRUD만으로 충분하기 때문에 추가적인 메서드들을 굳이 선언하지 않는다.
}
