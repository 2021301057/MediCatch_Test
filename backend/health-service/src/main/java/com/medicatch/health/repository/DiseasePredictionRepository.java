package com.medicatch.health.repository;

import com.medicatch.health.entity.DiseasePrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiseasePredictionRepository extends JpaRepository<DiseasePrediction, Long> {

    List<DiseasePrediction> findByUserIdOrderByCheckupDateDesc(Long userId);

    void deleteByUserIdAndPredictionType(Long userId, String predictionType);

    void deleteByUserId(Long userId);
}
