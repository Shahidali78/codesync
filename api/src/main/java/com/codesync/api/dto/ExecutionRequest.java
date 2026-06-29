package com.codesync.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ExecutionRequest {

    @NotBlank
    @Pattern(regexp = "^(cpp|python|javascript)$",
             message = "language must be one of: cpp, python, javascript")
    private String language;

    @NotBlank
    @Size(max = 65536, message = "code must not exceed 64 KB")
    private String code;

    private String sessionId;   // optional — links log to a session
}
