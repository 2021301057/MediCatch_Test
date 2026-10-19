package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthMealReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HealthMealReviewRepository extends JpaRepository<HealthMealReview, Long> {
    Optional<HealthMealReview> findByUserIdAndLogDateAndInputHash(Long userId, LocalDate logDate, String inputHash);
    List<HealthMealReview> findByUserIdAndLogDateBetween(Long userId, LocalDate start, LocalDate end);
}
