package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HealthPredictionRepository extends JpaRepository<HealthPrediction, Long> {

    List<HealthPrediction> findByUserIdOrderByCheckupDateDesc(Long userId);

    void deleteByUserIdAndPredictionType(Long userId, String predictionType);

    void deleteByUserId(Long userId);
}
