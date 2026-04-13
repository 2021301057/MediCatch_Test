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
    private Double bloodPressureSystolic;

    @Column
    private Double bloodPressureDiastolic;

    @Column
    private Double glucose;

    @Column
    private Double totalCholesterol;

    @Column
    private Double hdlCholesterol;

    @Column
    private Double ldlCholesterol;

    @Column
    private Double triglycerides;

    @Column
    private String abnormalFindings;

    @Column
    private String recommendations;

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
