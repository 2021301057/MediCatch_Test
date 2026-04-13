package com.medicatch.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistoryDto {

    private Long id;
    private String role;  // USER or ASSISTANT
    private String message;
    private String intentType;
    private LocalDateTime createdAt;
}
