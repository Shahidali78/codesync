package com.codesync.api.dto;

import lombok.*;

@Data @Builder
public class AuthResponse {
    private String token;
    private String username;
    private String email;
    private String role;
}
