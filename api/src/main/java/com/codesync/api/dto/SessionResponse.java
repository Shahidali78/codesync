package com.codesync.api.dto;

import com.codesync.api.entity.Session;
import lombok.*;

import java.time.LocalDateTime;

@Data @Builder
public class SessionResponse {
    private String id;
    private Long projectId;
    private Long ownerId;
    private boolean active;
    private LocalDateTime createdAt;

    public static SessionResponse from(Session s) {
        return SessionResponse.builder()
                .id(s.getId())
                .projectId(s.getProject().getId())
                .ownerId(s.getOwner().getId())
                .active(s.isActive())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
