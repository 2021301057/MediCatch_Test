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
@Table(name = "fixed_benefit_match_rules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FixedBenefitMatchRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String fixedBenefitCategory;

    @Column(nullable = false, length = 100)
    private String displayName;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String matchKeywords;

    @Column(columnDefinition = "LONGTEXT")
    private String excludeKeywords;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Builder.Default
    private Integer priority = 100;

    @Builder.Default
    private Boolean isActive = true;

    @Column(insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
