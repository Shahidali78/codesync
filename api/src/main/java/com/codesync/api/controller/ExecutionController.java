package com.codesync.api.controller;

import com.codesync.api.dto.*;
import com.codesync.api.service.ExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/execute")
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;

    @PostMapping
    public ResponseEntity<ExecutionResponse> execute(@Valid @RequestBody ExecutionRequest req,
                                                     @AuthenticationPrincipal UserDetails user)
            throws IOException, InterruptedException {
        return ResponseEntity.ok(executionService.execute(req, user.getUsername()));
    }
}
