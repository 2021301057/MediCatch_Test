package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "disease_predictions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiseasePrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 20)
    private String predictionType;   // STROKE / DIABETES / CARDIO

    @Column
    private LocalDate checkupDate;   // resCheckupDate

    @Column(length = 2)
    private String riskGrade;        // resRiskGrade (1~5)

    @Column(length = 20)
    private String riskRatio;        // resRatio (3년 내 발병 확률 %)

    @Column(length = 20)
    private String averageRatio;     // resAverageRatio (100명 중 위치)

    @Column(length = 10)
    private String averageAgeGroup;  // resAverageAge (연령대)

    @OneToMany(mappedBy = "prediction", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiseasePredictionFactor> factors;   // resDetailList

    @OneToMany(mappedBy = "prediction", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiseasePredictionCompare> compares; // resCompareList

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
