package com.codesync.api.repository;

import com.codesync.api.entity.CodeFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FileRepository extends JpaRepository<CodeFile, Long> {
    List<CodeFile> findByProjectIdOrderByNameAsc(Long projectId);
    Optional<CodeFile> findByIdAndProjectId(Long id, Long projectId);
    void deleteByIdAndProjectId(Long id, Long projectId);
}
