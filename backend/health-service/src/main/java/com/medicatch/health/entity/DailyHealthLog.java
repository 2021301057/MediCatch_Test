package com.medicatch.health.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_health_logs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_daily_health_log_user_date", columnNames = {"user_id", "log_date"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyHealthLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate logDate;

    @Column(length = 10)
    private String mealQuality;

    @Column(nullable = false)
    private boolean highSugarIntake;

    @Column(nullable = false)
    private boolean lateNightMeal;

    @Column
    private Integer walkingMinutes;

    @Column
    private Integer stepCount;

    @Column(nullable = false)
    private boolean exerciseCompleted;

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
