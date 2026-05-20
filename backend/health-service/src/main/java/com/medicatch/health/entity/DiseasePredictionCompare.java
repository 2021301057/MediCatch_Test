package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Table(name = "disease_prediction_compares")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiseasePredictionCompare {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prediction_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private DiseasePrediction prediction;

    @Column(length = 4)
    private String year;             // resCheckupDate (연도만)

    @Column(length = 20)
    private String predictedState;   // resState (그 해의 예측값)
}
