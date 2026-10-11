package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "diabetes_risk_profiles", uniqueConstraints = {
        @UniqueConstraint(name = "uk_diabetes_profile_user", columnNames = "user_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiabetesRiskProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column
    private Boolean familyHistoryDiabetes;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
