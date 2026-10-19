package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "health_ai_assessments", uniqueConstraints = {
        @UniqueConstraint(name = "uk_health_ai_input", columnNames = {"user_id", "input_hash", "prompt_version"})
}, indexes = {
        @Index(name = "idx_health_ai_user_created", columnList = "user_id,created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthAiAssessment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 24)
    private String riskLevel;

    @Column(nullable = false, length = 64)
    private String inputHash;

    @Column(nullable = false, length = 32)
    private String promptVersion;

    @Column(nullable = false, length = 120)
    private String modelName;

    @Column
    private Long checkupResultId;

    @Column
    private Long hba1cResultId;

    @Column(nullable = false, columnDefinition = "json")
    private String inputSnapshot;

    @Column(nullable = false, columnDefinition = "json")
    private String outputJson;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
