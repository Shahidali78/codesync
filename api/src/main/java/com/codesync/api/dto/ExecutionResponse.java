package com.codesync.api.dto;

import lombok.*;

@Data @Builder
public class ExecutionResponse {
    private String stdout;
    private String stderr;
    private Integer exitCode;
    private Long durationMs;
}
