package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "disease_prediction_yearly")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiseasePredictionYearly {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "factor_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private DiseasePredictionFactor factor;

    @Column(length = 4)
    private String year;            // resYear

    @Column(length = 20)
    private String myAmount;        // resProgressList[].resAmount

    @Column(length = 20)
    private String averageAmount;   // resAverageList[].resAmount (같은 year)
}
