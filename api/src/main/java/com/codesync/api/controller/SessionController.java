package com.codesync.api.controller;

import com.codesync.api.dto.SessionResponse;
import com.codesync.api.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    @GetMapping("/api/projects/{projectId}/sessions")
    public List<SessionResponse> listActive(@PathVariable Long projectId,
                                            @AuthenticationPrincipal UserDetails user) {
        return sessionService.listActive(projectId, user.getUsername());
    }

    @PostMapping("/api/projects/{projectId}/sessions")
    public ResponseEntity<SessionResponse> start(@PathVariable Long projectId,
                                                 @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.start(projectId, user.getUsername()));
    }

    @DeleteMapping("/api/sessions/{sessionId}")
    public ResponseEntity<Void> close(@PathVariable String sessionId,
                                      @AuthenticationPrincipal UserDetails user) {
        sessionService.close(sessionId, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
