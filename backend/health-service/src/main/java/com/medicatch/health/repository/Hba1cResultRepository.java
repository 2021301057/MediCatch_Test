package com.medicatch.health.repository;

import com.medicatch.health.entity.Hba1cResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface Hba1cResultRepository extends JpaRepository<Hba1cResult, Long> {
    List<Hba1cResult> findByUserIdOrderByTestDateDescIdDesc(Long userId);
    Optional<Hba1cResult> findByIdAndUserId(Long id, Long userId);
}
