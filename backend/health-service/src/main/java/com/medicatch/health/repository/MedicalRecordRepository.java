package com.medicatch.health.repository;

import com.medicatch.health.entity.MedicalRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MedicalRecordRepository extends JpaRepository<MedicalRecord, Long> {

    List<MedicalRecord> findByUserIdOrderByVisitDateDesc(Long userId);

    List<MedicalRecord> findByUserIdAndVisitDateBetween(Long userId, LocalDate startDate, LocalDate endDate);
}
