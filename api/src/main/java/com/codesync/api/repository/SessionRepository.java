package com.codesync.api.repository;

import com.codesync.api.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {
    List<Session> findByProjectIdAndActiveTrue(Long projectId);
    Optional<Session> findByIdAndActiveTrue(String id);
}
