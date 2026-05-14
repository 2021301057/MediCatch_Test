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
@Table(name = "pre_treatment_searches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreTreatmentSearch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String conditionSearched;

    private String treatmentId;

    private String treatmentName;

    private Double estimatedCost;

    private Double coverageRate;

    private Double estimatedCopay;

    private String hospitalType;

    @Builder.Default
    private Boolean ruleMatched = false;

    @Builder.Default
    private Boolean aiUsed = false;

    @Column(columnDefinition = "LONGTEXT")
    private String classificationJson;

    @Column(insertable = false, updatable = false)
    private LocalDateTime searchDate;
}
