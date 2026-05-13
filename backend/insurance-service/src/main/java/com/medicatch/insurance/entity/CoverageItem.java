package com.medicatch.insurance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "coverage_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CoverageItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private Policy policy;

    @Column(nullable = false)
    private String itemName;  // e.g., "외래 진료", "입원료"

    @Column(nullable = false)
    private String category;  // "OUTPATIENT", "INPATIENT", "MEDICATION", "SURGERY"

    @Column
    private Double coverageRate;  // Coverage percentage (e.g., 80.0)

    @Column
    private Double maxBenefitAmount;  // Maximum benefit amount

    @Column
    private Double avgGroupCoverageAmount;  // Average group coverage amount from CODEF statistics

    @Column
    private Double deductible;  // Deductible amount

    @Column
    private Double copay;  // Fixed copayment

    @Column(columnDefinition = "LONGTEXT")
    private String conditions;  // Coverage conditions

    @Column(columnDefinition = "LONGTEXT")
    private String exclusions;  // Exclusions and limitations

    @Column
    private boolean isCovered;

    @Column
    private Integer priority;  // Priority order for display
}
