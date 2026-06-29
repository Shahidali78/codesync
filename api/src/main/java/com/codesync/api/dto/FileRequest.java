package com.codesync.api.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class FileRequest {

    @NotBlank
    @Size(max = 255)
    private String name;

    private String content;
}
