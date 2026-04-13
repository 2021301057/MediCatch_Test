package com.medicatch.chat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_history", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_created_at", columnList = "created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;  // USER or ASSISTANT

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String message;

    @Column(name = "intent_type")
    private String intentType;  // Type of user intent (e.g., "INSURANCE_COVERAGE", "HEALTH_INFO", "CLAIM")

    @Column(columnDefinition = "LONGTEXT")
    private String contextJson;  // Additional context data as JSON

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum Role {
        USER, ASSISTANT
    }
}
