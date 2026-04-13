package com.medicatch.health.service;

import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.MedicalRecordRepository;
import com.medicatch.health.repository.MedicationDetailRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Transactional
public class HealthService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final CheckupResultRepository checkupResultRepository;
    private final MedicationDetailRepository medicationDetailRepository;

    public HealthService(MedicalRecordRepository medicalRecordRepository,
                         CheckupResultRepository checkupResultRepository,
                         MedicationDetailRepository medicationDetailRepository) {
        this.medicalRecordRepository = medicalRecordRepository;
        this.checkupResultRepository = checkupResultRepository;
        this.medicationDetailRepository = medicationDetailRepository;
    }

    /**
     * Get user's health summary
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getUserHealthSummary(Long userId) {
        log.info("Getting health summary for userId: {}", userId);

        Map<String, Object> summary = new HashMap<>();

        // Get recent medical records
        List<MedicalRecord> recentRecords = medicalRecordRepository.findByUserIdOrderByVisitDateDesc(userId);
        summary.put("recentMedicalRecords", recentRecords.isEmpty() ? "없음" : recentRecords.get(0).getDiagnosis());

        // Get latest checkup
        List<CheckupResult> checkups = checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId);
        if (!checkups.isEmpty()) {
            CheckupResult latestCheckup = checkups.get(0);
            summary.put("lastCheckup", latestCheckup.getCheckupDate());
            summary.put("bloodGlucose", latestCheckup.getGlucose());
            summary.put("totalCholesterol", latestCheckup.getTotalCholesterol());
        }

        // Get current medications
        List<MedicationDetail> currentMeds = medicationDetailRepository
                .findByUserIdAndEndDateIsNullOrderByPrescribedDateDesc(userId);
        summary.put("currentMedicationCount", currentMeds.size());

        return summary;
    }

    /**
     * Get medical records for date range
     */
    @Transactional(readOnly = true)
    public List<MedicalRecord> getMedicalRecords(Long userId, LocalDate startDate, LocalDate endDate) {
        log.info("Getting medical records for userId: {} from {} to {}", userId, startDate, endDate);
        return medicalRecordRepository.findByUserIdAndVisitDateBetween(userId, startDate, endDate);
    }

    /**
     * Get checkup results for date range
     */
    @Transactional(readOnly = true)
    public List<CheckupResult> getCheckupResults(Long userId, LocalDate startDate, LocalDate endDate) {
        log.info("Getting checkup results for userId: {} from {} to {}", userId, startDate, endDate);
        return checkupResultRepository.findByUserIdAndCheckupDateBetween(userId, startDate, endDate);
    }

    /**
     * Get current medications
     */
    @Transactional(readOnly = true)
    public List<MedicationDetail> getCurrentMedications(Long userId) {
        log.info("Getting current medications for userId: {}", userId);
        return medicationDetailRepository.findByUserIdAndEndDateIsNullOrderByPrescribedDateDesc(userId);
    }

    /**
     * Calculate health risk score
     */
    @Transactional(readOnly = true)
    public String calculateHealthRiskLevel(Long userId) {
        log.info("Calculating health risk for userId: {}", userId);

        List<CheckupResult> checkups = checkupResultRepository.findByUserIdOrderByCheckupDateDesc(userId);
        if (checkups.isEmpty()) {
            return "UNKNOWN";
        }

        CheckupResult latest = checkups.get(0);
        int riskScore = 0;

        // Check blood glucose
        if (latest.getGlucose() != null) {
            if (latest.getGlucose() > 125) riskScore += 3;
            else if (latest.getGlucose() > 110) riskScore += 2;
        }

        // Check cholesterol
        if (latest.getTotalCholesterol() != null && latest.getTotalCholesterol() > 240) {
            riskScore += 3;
        }

        // Check blood pressure
        if (latest.getBloodPressureSystolic() != null && latest.getBloodPressureSystolic() > 140) {
            riskScore += 3;
        }

        if (riskScore >= 5) return "HIGH";
        if (riskScore >= 3) return "MEDIUM";
        return "LOW";
    }
}
