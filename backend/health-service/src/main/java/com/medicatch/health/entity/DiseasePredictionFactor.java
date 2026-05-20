package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@Entity
@Table(name = "disease_prediction_factors")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiseasePredictionFactor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private DiseasePrediction prediction;

    @Column(length = 50)
    private String riskFactor;     // resRiskFactor (예: "수축기혈압", "LDL")

    @Column(length = 20)
    private String currentState;   // resState (현재 수치)

    @Column(length = 2)
    private String severityType;   // resType (1~5)

    @Column(length = 20)
    private String averageValue;   // resAverage (유사집단 평균)

    @Column
    private Integer sortOrder;

    @OneToMany(mappedBy = "factor", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DiseasePredictionYearly> yearly;
}
