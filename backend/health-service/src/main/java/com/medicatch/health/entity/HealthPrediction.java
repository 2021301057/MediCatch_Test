package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "health_predictions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 30)
    private String predictionType;  // HEALTH_AGE / STROKE / DIABETES / CARDIO

    @Column
    private LocalDate checkupDate;

    @Column(length = 2)
    private String riskGrade;       // "1"~"5"

    @Column(length = 20)
    private String riskRatio;       // resRatio (예: "1")

    @Column(length = 10)
    private String averageAge;      // resAverageAge (예: "30")

    @Column(length = 20)
    private String averageRatio;    // resAverageRatio (예: "21/100")

    @Column(columnDefinition = "LONGTEXT")
    private String rawJson;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
