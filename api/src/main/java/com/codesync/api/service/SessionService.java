package com.codesync.api.service;

import com.codesync.api.dto.SessionResponse;
import com.codesync.api.entity.*;
import com.codesync.api.exception.ResourceNotFoundException;
import com.codesync.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final ProjectService projectService;
    private final UserRepository userRepository;

    public List<SessionResponse> listActive(Long projectId, String username) {
        projectService.requireOwned(projectId, username);
        return sessionRepository.findByProjectIdAndActiveTrue(projectId)
                .stream().map(SessionResponse::from).toList();
    }

    @Transactional
    public SessionResponse start(Long projectId, String username) {
        Project project = projectService.requireOwned(projectId, username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Session session = Session.builder()
                .id(UUID.randomUUID().toString())
                .project(project)
                .owner(user)
                .build();

        return SessionResponse.from(sessionRepository.save(session));
    }

    @Transactional
    public void close(String sessionId, String username) {
        Session session = sessionRepository.findByIdAndActiveTrue(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found"));

        // Only the session owner can close it
        if (!session.getOwner().getUsername().equals(username)) {
            throw new org.springframework.security.access.AccessDeniedException("Not session owner");
        }
        session.setActive(false);
        sessionRepository.save(session);
    }
}
