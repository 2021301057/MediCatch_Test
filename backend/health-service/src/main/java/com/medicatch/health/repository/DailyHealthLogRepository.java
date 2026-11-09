package com.medicatch.health.repository;

import com.medicatch.health.entity.DailyHealthLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyHealthLogRepository extends JpaRepository<DailyHealthLog, Long> {
    Optional<DailyHealthLog> findByUserIdAndLogDate(Long userId, LocalDate logDate);
    List<DailyHealthLog> findByUserIdAndLogDateBetween(Long userId, LocalDate start, LocalDate end);
    List<DailyHealthLog> findTop7ByUserIdOrderByLogDateDesc(Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = """
            INSERT INTO daily_health_logs (
                user_id, log_date, meal_quality, meal_description, exercise_description,
                high_sugar_intake, late_night_meal, walking_minutes, step_count,
                exercise_completed, created_at, updated_at
            ) VALUES (
                :userId, :logDate, :mealQuality, :mealDescription, :exerciseDescription,
                :highSugarIntake, :lateNightMeal, NULL, NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) ON DUPLICATE KEY UPDATE
                meal_quality = VALUES(meal_quality),
                meal_description = VALUES(meal_description),
                exercise_description = VALUES(exercise_description),
                high_sugar_intake = VALUES(high_sugar_intake),
                late_night_meal = VALUES(late_night_meal),
                walking_minutes = NULL,
                step_count = NULL,
                exercise_completed = FALSE,
                updated_at = CURRENT_TIMESTAMP
            """, nativeQuery = true)
    int upsertDailyLog(@Param("userId") Long userId,
                       @Param("logDate") LocalDate logDate,
                       @Param("mealQuality") String mealQuality,
                       @Param("mealDescription") String mealDescription,
                       @Param("exerciseDescription") String exerciseDescription,
                       @Param("highSugarIntake") boolean highSugarIntake,
                       @Param("lateNightMeal") boolean lateNightMeal);
}
