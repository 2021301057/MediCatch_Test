package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "hba1c_results", indexes = {
        @Index(name = "idx_hba1c_user_date", columnList = "user_id,test_date")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hba1cResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate testDate;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal value;

    @Column(length = 150)
    private String organizationName;

    @Column(length = 500)
    private String note;

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
