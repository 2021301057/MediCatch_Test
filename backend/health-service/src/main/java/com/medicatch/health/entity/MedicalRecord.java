package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "medical_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MedicalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate visitDate;

    @Column(nullable = false)
    private String hospital;

    @Column(nullable = false)
    private String department;

    @Column(nullable = false)
    private String diagnosis;

    @Column(name = "disease_name", nullable = false)
    private String diseaseName;

    @Column(columnDefinition = "LONGTEXT")
    private String treatmentDetails;

    @Column
    private String medicationPrescribed;

    @Column
    private Double medicalCost;

    @Column
    private Double insuranceCoverage;

    @Column
    private Double outOfPocket;

    @Column(columnDefinition = "VARCHAR(20) DEFAULT 'UNCLAIMED'")
    @Builder.Default
    private String claimStatus = "UNCLAIMED";

    @Column(length = 20)
    private String diseaseCode;

    @Column
    private Double nonCoveredAmount;

    @Column(columnDefinition = "LONGTEXT")
    private String notes;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (diseaseName == null || diseaseName.isBlank()) {
            diseaseName = diagnosis != null && !diagnosis.isBlank() ? diagnosis : "기타";
        }
        if (diagnosis == null || diagnosis.isBlank()) {
            diagnosis = diseaseName;
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
