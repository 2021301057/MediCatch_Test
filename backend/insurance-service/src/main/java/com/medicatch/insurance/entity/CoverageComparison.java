package com.medicatch.insurance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "coverage_comparison")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CoverageComparison {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column
    private String codefId;

    @Column(nullable = false)
    private String coverageName;

    @Column
    private String coverageCode;

    @Column
    private Double selfCoverageAmount;

    @Column
    private Double avgGroupCoverageAmount;

    @Column(insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
