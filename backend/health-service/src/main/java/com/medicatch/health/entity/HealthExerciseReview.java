package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "health_exercise_reviews", uniqueConstraints = @UniqueConstraint(
        name = "uk_health_exercise_review_input", columnNames = {"user_id", "log_date", "input_hash"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthExerciseReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate logDate;

    @Column(nullable = false, length = 64)
    private String inputHash;

    @Column(nullable = false, length = 1000)
    private String exerciseDescription;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String reviewJson;

    @Column(nullable = false, length = 120)
    private String modelName;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }
}
