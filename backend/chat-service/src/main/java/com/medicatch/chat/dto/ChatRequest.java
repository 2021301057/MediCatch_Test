package com.medicatch.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotBlank(message = "Message is required")
    private String message;
}
