package com.medicatch.health.repository;

import com.medicatch.health.entity.HealthAgeResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HealthAgeResultRepository extends JpaRepository<HealthAgeResult, Long> {

    List<HealthAgeResult> findByUserIdOrderByCheckupDateDesc(Long userId);

    void deleteByUserId(Long userId);
}
