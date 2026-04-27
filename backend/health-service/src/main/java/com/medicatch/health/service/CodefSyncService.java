package com.medicatch.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.MedicalRecordRepository;
import com.medicatch.health.repository.MedicationDetailRepository;
import io.codef.api.EasyCodef;
import io.codef.api.EasyCodefServiceType;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class CodefSyncService {

    private static final String NHIS_URL = "/v1/kr/public/pp/nhis-health-checkup/result";
    private static final String HIRA_URL  = "/v1/kr/public/hw/hira-list/my-medical-information";
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    @Value("${codef.api-client-id:YOUR_API_CLIENT_ID}")
    private String clientId;
    @Value("${codef.api-client-secret:YOUR_API_CLIENT_SECRET}")
    private String clientSecret;
    @Value("${codef.demo-client-id:YOUR_DEMO_CLIENT_ID}")
    private String demoClientId;
    @Value("${codef.demo-client-secret:YOUR_DEMO_CLIENT_SECRET}")
    private String demoClientSecret;
    @Value("${codef.public-key:}")
    private String publicKey;
    @Value("${codef.use-demo:true}")
    private boolean useDemo;

    private final ObjectMapper objectMapper;
    private final MedicalRecordRepository medicalRecordRepo;
    private final CheckupResultRepository checkupResultRepo;
    private final MedicationDetailRepository medicationDetailRepo;
    private final ConcurrentHashMap<String, SyncSession> sessions = new ConcurrentHashMap<>();

    public CodefSyncService(ObjectMapper objectMapper,
                            MedicalRecordRepository medicalRecordRepo,
                            CheckupResultRepository checkupResultRepo,
                            MedicationDetailRepository medicationDetailRepo) {
        this.objectMapper = objectMapper;
        this.medicalRecordRepo = medicalRecordRepo;
        this.checkupResultRepo = checkupResultRepo;
        this.medicationDetailRepo = medicationDetailRepo;
    }

    // ── Step1: 1차 요청 (건강검진 + 진료정보 병렬 트리거) ──────────────────

    public SyncStep1Response syncStep1(Long userId, String userName, String phoneNo,
                                       String identity13, String telecom, String loginTypeLevel) {
        try {
            String identity8   = deriveIdentity8(identity13);
            String currentYear = String.valueOf(LocalDate.now().getYear());
            String today       = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            String sharedId    = "mc_" + userId;

            HashMap<String, Object> nhisParams = new HashMap<>();
            nhisParams.put("organization",    "0002");
            nhisParams.put("loginType",       "5");
            nhisParams.put("loginTypeLevel",  loginTypeLevel);
            nhisParams.put("userName",        userName);
            nhisParams.put("phoneNo",         phoneNo);
            nhisParams.put("identity",        identity8);
            nhisParams.put("searchStartYear", "2023");
            nhisParams.put("searchEndYear",   currentYear);
            nhisParams.put("id",              sharedId);
            if ("5".equals(loginTypeLevel)) nhisParams.put("telecom", telecom);

            HashMap<String, Object> hiraParams = new HashMap<>();
            hiraParams.put("organization",   "0020");
            hiraParams.put("loginType",      "5");
            hiraParams.put("loginTypeLevel", loginTypeLevel);
            hiraParams.put("userName",       userName);
            hiraParams.put("phoneNo",        phoneNo);
            hiraParams.put("identity",       identity13);
            hiraParams.put("startDate",      "20230101");
            hiraParams.put("endDate",        today);
            hiraParams.put("id",             sharedId);
            if ("5".equals(loginTypeLevel)) hiraParams.put("telecom", telecom);

            // 건강검진 + 진료정보 1차 동시 요청 (알림이 동시에 전송되도록)
            EasyCodefServiceType svcType = serviceType();
            CompletableFuture<String> nhisFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    log.info("NHIS 1차 요청 - userId: {}", userId);
                    return createCodef().requestProduct(NHIS_URL, svcType, nhisParams);
                } catch (Exception e) { throw new RuntimeException(e); }
            });
            CompletableFuture<String> hiraFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    log.info("HIRA 1차 요청 - userId: {}", userId);
                    return createCodef().requestProduct(HIRA_URL, svcType, hiraParams);
                } catch (Exception e) { throw new RuntimeException(e); }
            });

            String nhisResult = nhisFuture.get(90, TimeUnit.SECONDS);
            String hiraResult = hiraFuture.get(90, TimeUnit.SECONDS);
            log.info("NHIS 1차 응답: {}", nhisResult);
            log.info("HIRA 1차 응답: {}", hiraResult);

            Map<String, Object> nhisMap    = objectMapper.readValue(nhisResult, Map.class);
            Map<String, Object> nhisResult2 = toMap(nhisMap.get("result"));
            String nhisCode = (String) nhisResult2.get("code");
            if (!"CF-00000".equals(nhisCode) && !"CF-03002".equals(nhisCode)) {
                String msg = (String) nhisResult2.getOrDefault("message", "건강검진 정보 조회 실패");
                throw new RuntimeException("건강검진(NHIS) 오류 [" + nhisCode + "]: " + msg);
            }
            Map<String, Object> nhisData = toMap(nhisMap.get("data"));

            Map<String, Object> hiraMap    = objectMapper.readValue(hiraResult, Map.class);
            Map<String, Object> hiraResult2 = toMap(hiraMap.get("result"));
            String hiraCode = (String) hiraResult2.get("code");
            if (!"CF-00000".equals(hiraCode) && !"CF-03002".equals(hiraCode)) {
                String msg = (String) hiraResult2.getOrDefault("message", "진료정보 조회 실패");
                throw new RuntimeException("진료정보(HIRA) 오류 [" + hiraCode + "]: " + msg);
            }
            Map<String, Object> hiraData = toMap(hiraMap.get("data"));

            String sessionKey = UUID.randomUUID().toString();
            sessions.put(sessionKey, new SyncSession(
                    userId, nhisParams, nhisData, hiraParams, hiraData,
                    loginTypeLevel, LocalDateTime.now()
            ));

            log.info("건강 데이터 동기화 1차 완료 - sessionKey: {}", sessionKey);
            return new SyncStep1Response(sessionKey, loginTypeLevel, true);

        } catch (Exception e) {
            log.error("건강 데이터 동기화 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강 데이터 동기화 요청 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    // ── Step2: 2차 요청 (인증 확인 + DB 저장) ───────────────────────────

    @Transactional
    public SyncStep2Result syncStep2(String sessionKey, String smsAuthNo) {
        SyncSession session = getValidSession(sessionKey);
        try {
            int checkupCount = 0, medicalCount = 0, medicationCount = 0;

            // 건강검진 2차
            EasyCodef nhisCodef = createCodef();
            HashMap<String, Object> nhisCertMap = new HashMap<>(session.getNhisParams());
            nhisCertMap.put("twoWayInfo", buildTwoWayInfo(session.getNhisTwoWayData()));
            nhisCertMap.put("is2Way",    true);
            nhisCertMap.put("simpleAuth","1");
            if (smsAuthNo != null && !smsAuthNo.isBlank()) nhisCertMap.put("smsAuthNo", smsAuthNo);

            log.info("NHIS 2차 요청 - sessionKey: {}", sessionKey);
            String nhisResult = nhisCodef.requestCertification(NHIS_URL, serviceType(), nhisCertMap);
            log.debug("NHIS 2차 응답: {}", nhisResult);
            checkupCount = saveCheckupResults(session.getUserId(), nhisResult);

            Thread.sleep(500);

            // 진료정보 2차
            EasyCodef hiraCodef = createCodef();
            HashMap<String, Object> hiraCertMap = new HashMap<>(session.getHiraParams());
            hiraCertMap.put("twoWayInfo", buildTwoWayInfo(session.getHiraTwoWayData()));
            hiraCertMap.put("is2Way",    true);
            hiraCertMap.put("simpleAuth","1");
            if (smsAuthNo != null && !smsAuthNo.isBlank()) hiraCertMap.put("smsAuthNo", smsAuthNo);

            log.info("HIRA 2차 요청 - sessionKey: {}", sessionKey);
            String hiraResult = hiraCodef.requestCertification(HIRA_URL, serviceType(), hiraCertMap);
            log.debug("HIRA 2차 응답: {}", hiraResult);
            int[] hiraCounts = saveMedicalData(session.getUserId(), hiraResult);
            medicalCount    = hiraCounts[0];
            medicationCount = hiraCounts[1];

            sessions.remove(sessionKey);
            log.info("건강 데이터 동기화 완료 - userId: {}, checkups: {}, medicals: {}, medications: {}",
                    session.getUserId(), checkupCount, medicalCount, medicationCount);

            return new SyncStep2Result(checkupCount, medicalCount, medicationCount);

        } catch (Exception e) {
            log.error("건강 데이터 동기화 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강 데이터 동기화 확인 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    // ── 데이터 파싱 + 저장 ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private int saveCheckupResults(Long userId, String result) throws Exception {
        Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
        Map<String, Object> data = toMap(responseMap.get("data"));
        List<Map<String, Object>> previewList = (List<Map<String, Object>>) data.getOrDefault("resPreviewList", List.of());

        checkupResultRepo.deleteByUserId(userId);

        List<CheckupResult> toSave = new ArrayList<>();
        for (Map<String, Object> item : previewList) {
            String dateStr = str(item.get("resCheckupDate"));
            if (dateStr == null || dateStr.isBlank()) continue;

            String[] bp = str(item.getOrDefault("resBloodPressure", "")).split("/");

            toSave.add(CheckupResult.builder()
                    .userId(userId)
                    .checkupDate(parseDate8(dateStr))
                    .checkupType("REGULAR")
                    .height(parseDouble(item.get("resHeight")))
                    .weight(parseDouble(item.get("resWeight")))
                    .bloodPressureSystolic(bp.length > 0 ? parseDouble(bp[0]) : null)
                    .bloodPressureDiastolic(bp.length > 1 ? parseDouble(bp[1]) : null)
                    .glucose(parseDouble(item.get("resFastingBloodSuger")))
                    .totalCholesterol(parseDouble(item.get("resTotalCholesterol")))
                    .hdlCholesterol(parseDouble(item.get("resHDLCholesterol")))
                    .ldlCholesterol(parseDouble(item.get("resLDLCholesterol")))
                    .triglycerides(parseDouble(item.get("resTriglyceride")))
                    .abnormalFindings(str(item.get("resOpinion")))
                    .recommendations(str(item.get("resJudgement")))
                    .build());
        }
        checkupResultRepo.saveAll(toSave);
        return toSave.size();
    }

    @SuppressWarnings("unchecked")
    private int[] saveMedicalData(Long userId, String result) throws Exception {
        Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
        Map<String, Object> data = toMap(responseMap.get("data"));

        List<Map<String, Object>> basicList    = (List<Map<String, Object>>) data.getOrDefault("resBasicTreatList",    List.of());
        List<Map<String, Object>> prescribeList = (List<Map<String, Object>>) data.getOrDefault("resPrescribeDrugList", List.of());

        medicalRecordRepo.deleteByUserId(userId);
        medicationDetailRepo.deleteByUserId(userId);

        List<MedicalRecord> records = new ArrayList<>();
        for (Map<String, Object> item : basicList) {
            String dateStr = str(item.get("resTreatStartDate"));
            String hospital = str(item.get("resHospitalName"));
            if (dateStr == null || dateStr.isBlank() || hospital == null || hospital.isBlank()) continue;

            records.add(MedicalRecord.builder()
                    .userId(userId)
                    .visitDate(parseDate8(dateStr))
                    .hospital(hospital)
                    .department(strOrDefault(item.get("resDepartment"), "미상"))
                    .diagnosis(strOrDefault(item.get("resDiseaseName"), "기타"))
                    .treatmentDetails(str(item.get("resTreatType")))
                    .medicalCost(parseDouble(item.get("resTotalAmount")))
                    .insuranceCoverage(parseDouble(item.get("resPublicCharge")))
                    .outOfPocket(parseDouble(item.get("resDeductibleAmt")))
                    .notes("진단코드: " + strOrDefault(item.get("resDiseaseCode"), "-"))
                    .build());
        }
        medicalRecordRepo.saveAll(records);

        List<MedicationDetail> medications = new ArrayList<>();
        for (Map<String, Object> item : prescribeList) {
            String dateStr = str(item.get("resTreatStartDate"));
            String drugName = str(item.get("resDrugName"));
            if (dateStr == null || dateStr.isBlank() || drugName == null || drugName.isBlank()) continue;

            String daysStr = str(item.get("resTotalDosingdays"));
            medications.add(MedicationDetail.builder()
                    .userId(userId)
                    .medicationName(drugName)
                    .dosage(strOrDefault(item.get("resOneDose"), "1"))
                    .frequency(strOrDefault(item.get("resDailyDosesNumber"), "1일 1회"))
                    .duration(daysStr != null && !daysStr.isBlank() ? daysStr + "일" : null)
                    .prescribedDate(parseDate8(dateStr))
                    .indication(str(item.get("resIngredients")))
                    .build());
        }
        medicationDetailRepo.saveAll(medications);

        return new int[]{records.size(), medications.size()};
    }

    // ── 유틸리티 ────────────────────────────────────────────────────────

    private String deriveIdentity8(String identity13) {
        char gd = identity13.charAt(6);
        String century = (gd == '3' || gd == '4') ? "20" : "19";
        return century + identity13.substring(0, 6);
    }

    private EasyCodef createCodef() {
        EasyCodef codef = new EasyCodef();
        codef.setClientInfoForDemo(demoClientId, demoClientSecret);
        codef.setClientInfo(clientId, clientSecret);
        codef.setPublicKey(publicKey);
        return codef;
    }

    private EasyCodefServiceType serviceType() {
        return useDemo ? EasyCodefServiceType.DEMO : EasyCodefServiceType.API;
    }

    private HashMap<String, Object> buildTwoWayInfo(Map<String, Object> data) {
        HashMap<String, Object> info = new HashMap<>();
        info.put("jobIndex",        data.get("jobIndex"));
        info.put("threadIndex",     data.get("threadIndex"));
        info.put("jti",             data.get("jti"));
        info.put("twoWayTimestamp", data.get("twoWayTimestamp"));
        return info;
    }

    private SyncSession getValidSession(String sessionKey) {
        SyncSession s = sessions.get(sessionKey);
        if (s == null) throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        if (s.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            sessions.remove(sessionKey);
            throw new RuntimeException("인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return s;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object obj) {
        if (obj instanceof Map) return (Map<String, Object>) obj;
        return new HashMap<>();
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private String strOrDefault(Object o, String def) {
        String s = str(o);
        return (s == null) ? def : s;
    }

    private Double parseDouble(Object o) {
        if (o == null) return null;
        String s = o.toString().trim().replaceAll("[^0-9.]", "");
        if (s.isEmpty()) return null;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
    }

    private LocalDate parseDate8(String s) {
        if (s == null || s.length() < 8) return LocalDate.now();
        try {
            return LocalDate.parse(s.substring(0, 8), DateTimeFormatter.ofPattern("yyyyMMdd"));
        } catch (Exception e) {
            return LocalDate.now();
        }
    }

    // ── 세션/응답 DTO ────────────────────────────────────────────────────

    @Data
    @AllArgsConstructor
    public static class SyncStep1Response {
        private String sessionKey;
        private String loginTypeLevel;
        private boolean requiresTwoWay;
    }

    @Data
    @AllArgsConstructor
    public static class SyncStep2Result {
        private int savedCheckups;
        private int savedMedicals;
        private int savedMedications;
    }

    @Data
    @AllArgsConstructor
    private static class SyncSession {
        private Long userId;
        private HashMap<String, Object> nhisParams;
        private Map<String, Object> nhisTwoWayData;
        private HashMap<String, Object> hiraParams;
        private Map<String, Object> hiraTwoWayData;
        private String authMethod;
        private LocalDateTime createdAt;
    }
}
