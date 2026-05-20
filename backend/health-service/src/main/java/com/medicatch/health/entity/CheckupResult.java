package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "checkup_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckupResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate checkupDate;

    @Column(nullable = false)
    private String checkupType;  // "REGULAR", "SPECIFIC", "WORKPLACE"

    @Column
    private Double height;

    @Column
    private Double weight;

    @Column
    private Double waist;                  // resWaist

    @Column
    private Double bmi;                    // resBMI

    @Column(length = 30)
    private String sight;                  // resSight (예: "1.2/1.0")

    @Column(length = 30)
    private String hearing;                // resHearing

    @Column
    private Double bloodPressureSystolic;

    @Column
    private Double bloodPressureDiastolic;

    @Column(length = 20)
    private String urinaryProtein;         // resUrinaryProtein

    @Column
    private Double hemoglobin;             // resHemoglobin

    @Column
    private Double glucose;                // resFastingBloodSuger

    @Column
    private Double totalCholesterol;

    @Column
    private Double hdlCholesterol;

    @Column
    private Double ldlCholesterol;

    @Column
    private Double triglycerides;

    @Column
    private Double serumCreatinine;        // resSerumCreatinine

    @Column
    private Double gfr;                    // resGFR

    @Column
    private Double ast;                    // resAST

    @Column
    private Double alt;                    // resALT

    @Column
    private Double gammaGtp;               // resyGPT

    @Column(length = 50)
    private String tbChestDisease;         // resTBChestDisease

    @Column(length = 50)
    private String osteoporosis;           // resOsteoporosis

    @Column(length = 100)
    private String organizationName;       // resOrganizationName

    @Column
    private String abnormalFindings;       // resOpinion

    @Column
    private String recommendations;        // resJudgement

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
