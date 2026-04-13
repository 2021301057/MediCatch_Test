package com.medicatch.health.repository;

import com.medicatch.health.entity.CheckupResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CheckupResultRepository extends JpaRepository<CheckupResult, Long> {

    List<CheckupResult> findByUserIdOrderByCheckupDateDesc(Long userId);

    List<CheckupResult> findByUserIdAndCheckupDateBetween(Long userId, LocalDate startDate, LocalDate endDate);
}
