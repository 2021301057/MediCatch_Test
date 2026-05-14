package com.medicatch.analysis.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "treatment_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TreatmentRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String keyword;

    @Column(columnDefinition = "LONGTEXT")
    private String synonyms;

    @Column(length = 30)
    private String injuryDiseaseType;

    @Column(length = 30)
    private String careType;

    @Column(length = 30)
    private String benefitType;

    @Column(length = 50)
    private String treatmentCategory;

    @Column(length = 50)
    private String actualLossCategory;

    @Column(length = 50)
    private String fixedBenefitCategory;

    @Builder.Default
    private Boolean needsUserConfirmation = false;

    @Column(columnDefinition = "LONGTEXT")
    private String cautionMessage;

    @Builder.Default
    private Integer priority = 100;

    @Builder.Default
    private Boolean isActive = true;

    @Column(insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
