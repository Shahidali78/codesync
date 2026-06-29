package com.codesync.api.repository;

import com.codesync.api.entity.ExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExecutionLogRepository extends JpaRepository<ExecutionLog, Long> {
    List<ExecutionLog> findBySessionIdOrderByCreatedAtDesc(String sessionId);
    List<ExecutionLog> findByUserIdOrderByCreatedAtDesc(Long userId);
    long countByLanguage(String language);
}
