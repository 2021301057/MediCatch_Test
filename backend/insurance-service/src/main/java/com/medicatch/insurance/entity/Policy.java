package com.medicatch.insurance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "policies")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Policy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String policyNumber;

    @Column(nullable = false)
    private String insurerName;  // 보험사명

    @Column(nullable = false)
    private String insuranceType;  // "NATIONAL_HEALTH", "SUPPLEMENTARY", "ACCIDENT"

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private boolean isActive;

    @Column
    private Double monthlyPremium;

    @Column
    private Double annualPremium;

    @Column(columnDefinition = "LONGTEXT")
    private String policyDetails;

    @Column(columnDefinition = "LONGTEXT")
    private String terms;

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CoverageItem> coverageItems;

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
