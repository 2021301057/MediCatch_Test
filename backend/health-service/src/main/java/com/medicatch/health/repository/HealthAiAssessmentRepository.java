package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthAiAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HealthAiAssessmentRepository extends JpaRepository<HealthAiAssessment, Long> {
    Optional<HealthAiAssessment> findByUserIdAndInputHashAndPromptVersion(
            Long userId, String inputHash, String promptVersion);
}
