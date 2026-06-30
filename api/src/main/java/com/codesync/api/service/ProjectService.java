package com.codesync.api.service;

import com.codesync.api.dto.*;
import com.codesync.api.entity.*;
import com.codesync.api.exception.ResourceNotFoundException;
import com.codesync.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ProjectResponse> listForUser(String username) {
        User user = getUser(username);
        return projectRepository.findByOwnerIdOrderByUpdatedAtDesc(user.getId())
                .stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getById(Long id, String username) {
        User user = getUser(username);
        Project project = projectRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        return ProjectResponse.from(project);
    }

    @Transactional
    public ProjectResponse create(ProjectRequest req, String username) {
        User user = getUser(username);
        Project project = Project.builder()
                .name(req.getName())
                .description(req.getDescription())
                .language(req.getLanguage())
                .owner(user)
                .build();
        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectRequest req, String username) {
        User user = getUser(username);
        Project project = projectRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        project.setName(req.getName());
        project.setDescription(req.getDescription());
        project.setLanguage(req.getLanguage());
        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public void delete(Long id, String username) {
        User user = getUser(username);
        Project project = projectRepository.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        projectRepository.delete(project);
    }

    // package-visible helper used by FileService / SessionService
    Project requireOwned(Long projectId, String username) {
        User user = getUser(username);
        return projectRepository.findByIdAndOwnerId(projectId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }
}
