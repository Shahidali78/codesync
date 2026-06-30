package com.codesync.api.service;

import com.codesync.api.dto.*;
import com.codesync.api.entity.*;
import com.codesync.api.exception.ResourceNotFoundException;
import com.codesync.api.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FileService {

    private final FileRepository fileRepository;
    private final ProjectService projectService;

    @Transactional(readOnly = true)
    public List<FileResponse> listForProject(Long projectId, String username) {
        projectService.requireOwned(projectId, username);
        return fileRepository.findByProjectIdOrderByNameAsc(projectId)
                .stream().map(FileResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public FileResponse getById(Long projectId, Long fileId, String username) {
        projectService.requireOwned(projectId, username);
        CodeFile file = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));
        return FileResponse.from(file);
    }

    @Transactional
    public FileResponse create(Long projectId, FileRequest req, String username) {
        Project project = projectService.requireOwned(projectId, username);
        CodeFile file = CodeFile.builder()
                .name(req.getName())
                .content(req.getContent())
                .project(project)
                .build();
        return FileResponse.from(fileRepository.save(file));
    }

    @Transactional
    public FileResponse update(Long projectId, Long fileId, FileRequest req, String username) {
        projectService.requireOwned(projectId, username);
        CodeFile file = fileRepository.findByIdAndProjectId(fileId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));
        file.setName(req.getName());
        file.setContent(req.getContent());
        return FileResponse.from(fileRepository.save(file));
    }

    @Transactional
    public void delete(Long projectId, Long fileId, String username) {
        projectService.requireOwned(projectId, username);
        if (fileRepository.findByIdAndProjectId(fileId, projectId).isEmpty()) {
            throw new ResourceNotFoundException("File not found");
        }
        fileRepository.deleteByIdAndProjectId(fileId, projectId);
    }
}
