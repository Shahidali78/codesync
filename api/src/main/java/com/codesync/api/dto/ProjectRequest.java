package com.codesync.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ProjectRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    private String description;

    @Size(max = 50)
    private String language;
}
