package com.codesync.api.dto;

import com.codesync.api.entity.CodeFile;
import lombok.*;

import java.time.LocalDateTime;

@Data @Builder
public class FileResponse {
    private Long id;
    private String name;
    private String content;
    private Long projectId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FileResponse from(CodeFile f) {
        return FileResponse.builder()
                .id(f.getId())
                .name(f.getName())
                .content(f.getContent())
                .projectId(f.getProject().getId())
                .createdAt(f.getCreatedAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }
}
