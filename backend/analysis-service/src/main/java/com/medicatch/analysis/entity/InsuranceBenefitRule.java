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
@Table(name = "insurance_benefit_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InsuranceBenefitRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String generationCode;

    @Column(nullable = false, length = 30)
    private String careType;

    @Column(nullable = false, length = 30)
    private String benefitType;

    @Column(length = 50)
    private String treatmentCategory;

    @Column(length = 50)
    private String actualLossCategory;

    private Double reimbursementRate;

    private Double patientCopayRate;

    private Double fixedDeductible;

    @Column(length = 30)
    private String deductibleMethod;

    private Double limitAmount;

    private Integer limitCount;

    @Builder.Default
    private Boolean requiresRider = false;

    @Builder.Default
    private Boolean isExcluded = false;

    @Column(columnDefinition = "LONGTEXT")
    private String note;

    @Builder.Default
    private Integer priority = 100;

    @Builder.Default
    private Boolean isActive = true;

    @Column(insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
