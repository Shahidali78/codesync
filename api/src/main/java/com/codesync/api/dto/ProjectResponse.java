package com.codesync.api.dto;

import com.codesync.api.entity.Project;
import lombok.*;

import java.time.LocalDateTime;

@Data @Builder
public class ProjectResponse {
    private Long id;
    private String name;
    private String description;
    private String language;
    private Long ownerId;
    private String ownerUsername;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ProjectResponse from(Project p) {
        return ProjectResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .description(p.getDescription())
                .language(p.getLanguage())
                .ownerId(p.getOwner().getId())
                .ownerUsername(p.getOwner().getUsername())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
