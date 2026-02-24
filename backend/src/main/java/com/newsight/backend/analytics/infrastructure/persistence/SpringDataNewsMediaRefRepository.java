// backend/src/main/java/com/newsight/backend/analytics/infrastructure/persistence/SpringDataNewsMediaRefRepository.java
package com.newsight.backend.analytics.infrastructure.persistence;

import com.newsight.backend.analytics.domain.model.reference.NewsMediaRef;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataNewsMediaRefRepository extends JpaRepository<NewsMediaRef, Integer> {}