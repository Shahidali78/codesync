package com.codesync.api.controller;

import com.codesync.api.dto.*;
import com.codesync.api.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectResponse> list(@AuthenticationPrincipal UserDetails user) {
        return projectService.listForUser(user.getUsername());
    }

    @GetMapping("/{id}")
    public ProjectResponse get(@PathVariable Long id,
                               @AuthenticationPrincipal UserDetails user) {
        return projectService.getById(id, user.getUsername());
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectRequest req,
                                                  @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectService.create(req, user.getUsername()));
    }

    @PutMapping("/{id}")
    public ProjectResponse update(@PathVariable Long id,
                                  @Valid @RequestBody ProjectRequest req,
                                  @AuthenticationPrincipal UserDetails user) {
        return projectService.update(id, req, user.getUsername());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @AuthenticationPrincipal UserDetails user) {
        projectService.delete(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
