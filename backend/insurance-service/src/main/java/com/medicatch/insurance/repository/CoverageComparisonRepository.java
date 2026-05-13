package com.medicatch.insurance.repository;

import com.medicatch.insurance.entity.CoverageComparison;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoverageComparisonRepository extends JpaRepository<CoverageComparison, Long> {

    List<CoverageComparison> findByUserId(Long userId);

    void deleteByCodefId(String codefId);
}
