package com.codesync.api.controller;

import com.codesync.api.dto.*;
import com.codesync.api.service.FileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @GetMapping
    public List<FileResponse> list(@PathVariable Long projectId,
                                   @AuthenticationPrincipal UserDetails user) {
        return fileService.listForProject(projectId, user.getUsername());
    }

    @GetMapping("/{fileId}")
    public FileResponse get(@PathVariable Long projectId,
                            @PathVariable Long fileId,
                            @AuthenticationPrincipal UserDetails user) {
        return fileService.getById(projectId, fileId, user.getUsername());
    }

    @PostMapping
    public ResponseEntity<FileResponse> create(@PathVariable Long projectId,
                                               @Valid @RequestBody FileRequest req,
                                               @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fileService.create(projectId, req, user.getUsername()));
    }

    @PutMapping("/{fileId}")
    public FileResponse update(@PathVariable Long projectId,
                               @PathVariable Long fileId,
                               @Valid @RequestBody FileRequest req,
                               @AuthenticationPrincipal UserDetails user) {
        return fileService.update(projectId, fileId, req, user.getUsername());
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> delete(@PathVariable Long projectId,
                                       @PathVariable Long fileId,
                                       @AuthenticationPrincipal UserDetails user) {
        fileService.delete(projectId, fileId, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
