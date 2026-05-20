package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "health_age_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HealthAgeResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column
    private LocalDate checkupDate;        // resCheckupDate

    @Column
    private Integer biologicalAge;        // resAge

    @Column
    private Integer chronologicalAge;     // resChronologicalAge

    @Column(columnDefinition = "TEXT")
    private String summaryNote;           // resNote

    @Column(columnDefinition = "TEXT")
    private String detailMessage;         // resNote1

    @Column(columnDefinition = "TEXT")
    private String changeAfterMessage;    // resChangeAfter

    @Column(length = 10)
    private String gender;                // resGender

    @Column
    private Double height;                // resHeight

    @Column
    private Double weight;                // resWeight

    @OneToMany(mappedBy = "result", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<HealthAgeFactor> factors;

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
