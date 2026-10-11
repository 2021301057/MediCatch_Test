package com.medicatch.health.repository;

import com.medicatch.health.entity.DiabetesRiskProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DiabetesRiskProfileRepository extends JpaRepository<DiabetesRiskProfile, Long> {
    Optional<DiabetesRiskProfile> findByUserId(Long userId);
}
