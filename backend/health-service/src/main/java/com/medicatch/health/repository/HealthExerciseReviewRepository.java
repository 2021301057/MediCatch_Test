package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthExerciseReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface HealthExerciseReviewRepository extends JpaRepository<HealthExerciseReview, Long> {
    Optional<HealthExerciseReview> findByUserIdAndLogDateAndInputHash(Long userId, LocalDate logDate, String inputHash);
}
