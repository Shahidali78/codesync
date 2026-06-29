package com.codesync.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank
    private String username;   // username or email accepted

    @NotBlank
    private String password;
}
