package com.medicatch.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {

    private Long chatId;
    private String message;
    private String intentType;
    private Map<String, Object> relatedData;
    private LocalDateTime createdAt;
    private String language;  // "ko" for Korean
}
