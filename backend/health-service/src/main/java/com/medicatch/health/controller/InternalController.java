package com.medicatch.health.controller;

import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.DiseasePredictionRepository;
import com.medicatch.health.repository.HealthAgeResultRepository;
import com.medicatch.health.repository.MedicalRecordRepository;
import com.medicatch.health.repository.MedicationDetailRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal")
public class InternalController {

    private final MedicalRecordRepository medicalRecordRepository;
    private final CheckupResultRepository checkupResultRepository;
    private final MedicationDetailRepository medicationDetailRepository;
    private final DiseasePredictionRepository diseasePredictionRepository;
    private final HealthAgeResultRepository healthAgeResultRepository;

    public InternalController(MedicalRecordRepository medicalRecordRepository,
                              CheckupResultRepository checkupResultRepository,
                              MedicationDetailRepository medicationDetailRepository,
                              DiseasePredictionRepository diseasePredictionRepository,
                              HealthAgeResultRepository healthAgeResultRepository) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.checkupResultRepository = checkupResultRepository;
        this.medicationDetailRepository = medicationDetailRepository;
        this.diseasePredictionRepository = diseasePredictionRepository;
        this.healthAgeResultRepository = healthAgeResultRepository;
    }

    @DeleteMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteUserData(@PathVariable Long userId) {
        log.info("DELETE /internal/users/{} - 건강 데이터 전체 삭제", userId);
        medicalRecordRepository.deleteByUserId(userId);
        checkupResultRepository.deleteByUserId(userId);
        medicationDetailRepository.deleteByUserId(userId);
        diseasePredictionRepository.deleteByUserId(userId);
        healthAgeResultRepository.deleteByUserId(userId);
        log.info("건강 데이터 삭제 완료 - userId: {}", userId);
        return ResponseEntity.ok(Map.of("message", "건강 데이터가 삭제되었습니다."));
    }
}
