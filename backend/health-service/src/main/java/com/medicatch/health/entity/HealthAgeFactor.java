package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "health_age_factors")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthAgeFactor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private HealthAgeResult result;

    @Column(length = 50)
    private String riskFactor;        // resRiskFactor

    @Column(length = 50)
    private String currentState;      // resState

    @Column(columnDefinition = "TEXT")
    private String message;           // resType (텍스트 메시지)

    @Column(columnDefinition = "TEXT")
    private String recommendValue;    // resRecommendValue

    @Column(length = 50)
    private String decreaseValue;     // resDecreaseValue

    @Column
    private Integer sortOrder;
}
