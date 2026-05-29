package com.medicatch.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.DiseasePrediction;
import com.medicatch.health.entity.DiseasePredictionCompare;
import com.medicatch.health.entity.DiseasePredictionFactor;
import com.medicatch.health.entity.DiseasePredictionYearly;
import com.medicatch.health.entity.HealthAgeResult;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.DiseasePredictionRepository;
import com.medicatch.health.repository.HealthAgeResultRepository;
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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@Service
public class CodefSyncService {

    private static final String NHIS_URL        = "/v1/kr/public/pp/nhis-health-checkup/result";
    private static final String HEALTH_AGE_URL  = "/v1/kr/public/pp/hi-nhis-list/review-health-age";
    private static final String STROKE_URL      = "/v1/kr/public/pp/hi-nhis-list/stroke";
    private static final String DIABETES_URL    = "/v1/kr/public/pp/hi-nhis-list/diabetes";
    private static final String CARDIO_URL      = "/v1/kr/public/pp/hi-nhis-list/cardio-cerebrovascular";
    private static final String HIRA_URL = "/v1/kr/public/hw/hira-list/my-medical-information";
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    // 질병 예측 타입 식별자
    private static final String API_CHECKUP    = "CHECKUP";
    private static final String API_HEALTH_AGE = "HEALTH_AGE";
    private static final String API_STROKE     = "STROKE";
    private static final String API_DIABETES   = "DIABETES";
    private static final String API_CARDIO     = "CARDIO";

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
    private final DiseasePredictionRepository diseasePredictionRepo;
    private final HealthAgeResultRepository healthAgeResultRepo;
    private final ConcurrentHashMap<String, SyncSession>                              sessions         = new ConcurrentHashMap<>();
    /** 건강검진 + 예측 4개 멀티 세션 (sessionKey → 5개 API 컨텍스트) */
    private final ConcurrentHashMap<String, CheckupMultiSession>                      checkupMultiSessions = new ConcurrentHashMap<>();

    // 예측 4개 병렬용 전용 스레드풀 — ForkJoinPool.commonPool() 블로킹 I/O 기아 방지
    private final ExecutorService predictionExecutor = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "codef-prediction");
        t.setDaemon(true);
        return t;
    });

    public CodefSyncService(ObjectMapper objectMapper,
                            MedicalRecordRepository medicalRecordRepo,
                            CheckupResultRepository checkupResultRepo,
                            MedicationDetailRepository medicationDetailRepo,
                            DiseasePredictionRepository diseasePredictionRepo,
                            HealthAgeResultRepository healthAgeResultRepo) {
        this.objectMapper = objectMapper;
        this.medicalRecordRepo = medicalRecordRepo;
        this.checkupResultRepo = checkupResultRepo;
        this.medicationDetailRepo = medicationDetailRepo;
        this.diseasePredictionRepo = diseasePredictionRepo;
        this.healthAgeResultRepo = healthAgeResultRepo;
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
            nhisParams.put("searchStartYear", "2020");
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

            // NHIS + HIRA 1차 요청
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
            // 민감 정보(주민번호/진단명/처방내역) 평문 출력 금지 — 응답 길이만 로깅

            Map<String, Object> nhisMap     = objectMapper.readValue(nhisResult, Map.class);
            Map<String, Object> nhisResult2 = toMap(nhisMap.get("result"));
            String nhisCode = (String) nhisResult2.get("code");
            if (!"CF-00000".equals(nhisCode) && !"CF-03002".equals(nhisCode)) {
                String msg = (String) nhisResult2.getOrDefault("message", "건강검진 정보 조회 실패");
                throw new RuntimeException("건강검진(NHIS) 오류 [" + nhisCode + "]: " + msg);
            }
            Map<String, Object> nhisData = toMap(nhisMap.get("data"));

            Map<String, Object> hiraMap     = objectMapper.readValue(hiraResult, Map.class);
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
            String yearStr = str(item.get("resCheckupYear"));
            String dateStr = str(item.get("resCheckupDate"));
            if (dateStr == null || dateStr.isBlank()) continue;

            // CODEF resPreviewList: resCheckupDate는 MMDD(4자리), resCheckupYear가 별도 필드.
            String fullDate = (dateStr.length() == 4 && yearStr != null && yearStr.length() == 4)
                    ? yearStr + dateStr
                    : dateStr;

            String[] bp = str(item.getOrDefault("resBloodPressure", "")).split("/");

            toSave.add(CheckupResult.builder()
                    .userId(userId)
                    .checkupDate(parseDate8(fullDate))
                    .checkupType("REGULAR")
                    .height(parseDouble(item.get("resHeight")))
                    .weight(parseDouble(item.get("resWeight")))
                    .waist(parseDouble(item.get("resWaist")))
                    .bmi(parseDouble(item.get("resBMI")))
                    .sight(str(item.get("resSight")))
                    .hearing(str(item.get("resHearing")))
                    .bloodPressureSystolic(bp.length > 0 ? parseDouble(bp[0]) : null)
                    .bloodPressureDiastolic(bp.length > 1 ? parseDouble(bp[1]) : null)
                    .urinaryProtein(str(item.get("resUrinaryProtein")))
                    .hemoglobin(parseDouble(item.get("resHemoglobin")))
                    .glucose(parseDouble(item.get("resFastingBloodSuger")))
                    .totalCholesterol(parseDouble(item.get("resTotalCholesterol")))
                    .hdlCholesterol(parseDouble(item.get("resHDLCholesterol")))
                    .ldlCholesterol(parseDouble(item.get("resLDLCholesterol")))
                    .triglycerides(parseDouble(item.get("resTriglyceride")))
                    .serumCreatinine(parseDouble(item.get("resSerumCreatinine")))
                    .gfr(parseDouble(item.get("resGFR")))
                    .ast(parseDouble(item.get("resAST")))
                    .alt(parseDouble(item.get("resALT")))
                    .gammaGtp(parseDouble(item.get("resyGPT")))
                    .tbChestDisease(str(item.get("resTBChestDisease")))
                    .osteoporosis(str(item.get("resOsteoporosis")))
                    .organizationName(str(item.get("resOrganizationName")))
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

            String diseaseCode = str(item.get("resDiseaseCode"));
            records.add(MedicalRecord.builder()
                    .userId(userId)
                    .visitDate(parseDate8(dateStr))
                    .hospital(hospital)
                    .department(strOrDefault(item.get("resDepartment"), "미상"))
                    .diagnosis(strOrDefault(item.get("resDiseaseName"), "기타"))
                    .diseaseCode(diseaseCode)
                    .treatmentDetails(str(item.get("resTreatType")))
                    .medicalCost(parseDouble(item.get("resTotalAmount")))
                    .insuranceCoverage(parseDouble(item.get("resPublicCharge")))
                    .outOfPocket(parseDouble(item.get("resDeductibleAmt")))
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

    // ── 개별 API 세션 ────────────────────────────────────────────────────

    private final ConcurrentHashMap<String, SingleSession> singleSessions = new ConcurrentHashMap<>();

    @Data
    @AllArgsConstructor
    private static class SingleSession {
        private Long userId;
        private HashMap<String, Object> params;
        private Map<String, Object> twoWayData;
        private LocalDateTime createdAt;
    }

    private SingleSession getValidSingleSession(String sessionKey) {
        SingleSession s = singleSessions.get(sessionKey);
        if (s == null) throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        if (s.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            singleSessions.remove(sessionKey);
            throw new RuntimeException("인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return s;
    }

    // ── 건강검진(NHIS) + 질병 예측 4개 ──────────────────────────────────
    // 옵션 B: 건강검진은 필수, 예측은 옵션 (부분 실패 허용)

    public String syncCheckupStep1(Long userId, String userName, String phoneNo,
                                   String identity13, String telecom, String loginTypeLevel) {
        try {
            String identity8   = deriveIdentity8(identity13);
            String currentYear = String.valueOf(LocalDate.now().getYear());
            // SSO 그룹핑 키 — 매 호출마다 새 UUID. 같은 호출 내 5개 API가 공유.
            // 고정값 사용 시 이전 미완료 세션과 충돌해 CF-12001 (사용자 입력 시간 초과) 발생.
            String sharedId    = "mc_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8);
            EasyCodefServiceType svcType = serviceType();

            // 1) 건강검진 파라미터 (searchStartYear/EndYear 사용)
            HashMap<String, Object> checkupParams = new HashMap<>();
            checkupParams.put("organization",    "0002");
            checkupParams.put("loginType",       "5");
            checkupParams.put("loginTypeLevel",  loginTypeLevel);
            checkupParams.put("userName",        userName);
            checkupParams.put("phoneNo",         phoneNo);
            checkupParams.put("identity",        identity8);
            checkupParams.put("searchStartYear", "2020");
            checkupParams.put("searchEndYear",   currentYear);
            checkupParams.put("id",              sharedId);
            if ("5".equals(loginTypeLevel)) checkupParams.put("telecom", telecom);

            // 2) 예측 API 4개 공통 파라미터 빌더 (type="0" 사용, searchStartYear 없음)
            String[] predictionTypes = { API_HEALTH_AGE, API_STROKE, API_DIABETES, API_CARDIO };
            String[] predictionUrls  = { HEALTH_AGE_URL, STROKE_URL, DIABETES_URL, CARDIO_URL };

            // SSO 그룹핑: sharedId 공유 + sharedCodef 단일 인스턴스로 CODEF 서버가 1회 push로 묶음.
            // CHECKUP을 단독으로 먼저 완료(CF-03002 수신)한 뒤 예측 4개를 발사해야
            // CHECKUP의 requestProduct가 예측 요청과 경쟁하며 블로킹되는 현상을 방지함.
            final EasyCodef sharedCodef = createCodef();

            // 1) 건강검진 1차 요청 — 단독 동기 실행 (SSO 세션 선점)
            CheckupApiContext checkupCtx = fireFirstRequest(sharedCodef, API_CHECKUP, NHIS_URL, checkupParams, svcType);

            // 건강검진 응답코드 검증
            if (checkupCtx == null
                || (!"CF-00000".equals(checkupCtx.getFirstResponseCode())
                 && !"CF-03002".equals(checkupCtx.getFirstResponseCode()))) {
                String code = checkupCtx != null ? checkupCtx.getFirstResponseCode() : "UNKNOWN";
                String userMsg;
                if ("CF-12001".equals(code)) {
                    userMsg = "이전 인증이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.";
                } else {
                    userMsg = "건강검진 정보를 불러올 수 없습니다.";
                }
                throw new RuntimeException("건강검진(NHIS) 오류 [" + code + "]: " + userMsg);
            }

            // 2) 예측 4개 — CHECKUP 완료 직후 800ms 간격으로 백그라운드 발사 (응답 대기 없음)
            List<CompletableFuture<CheckupApiContext>> predictionFutures = new ArrayList<>();
            for (int i = 0; i < predictionTypes.length; i++) {
                final String pType = predictionTypes[i];
                final String pUrl  = predictionUrls[i];
                final int    delay = 800 * (i + 1); // 800ms, 1600ms, 2400ms, 3200ms
                HashMap<String, Object> predParams = new HashMap<>();
                predParams.put("organization",   "0002");
                predParams.put("loginType",      "5");
                predParams.put("loginTypeLevel", loginTypeLevel);
                predParams.put("userName",       userName);
                predParams.put("phoneNo",        phoneNo);
                predParams.put("identity",       identity8);
                predParams.put("type",           "0");
                predParams.put("id",             sharedId);
                if ("5".equals(loginTypeLevel)) predParams.put("telecom", telecom);

                predictionFutures.add(CompletableFuture.supplyAsync(() -> {
                    try { Thread.sleep(delay); } catch (InterruptedException ignored) {}
                    return fireFirstRequest(sharedCodef, pType, pUrl, predParams, svcType);
                }, predictionExecutor));
            }

            // 세션에 CHECKUP + 백그라운드 futures 저장 후 즉시 반환
            // 예측 결과는 Step 2에서 사용자 인증 대기 시간 동안 수집
            String sessionKey = UUID.randomUUID().toString();
            List<CheckupApiContext> initialApis = new ArrayList<>();
            initialApis.add(checkupCtx);
            checkupMultiSessions.put(sessionKey,
                    new CheckupMultiSession(userId, initialApis, new ArrayList<>(), predictionFutures, LocalDateTime.now()));
            log.info("건강검진 1차 완료, 예측 백그라운드 발사 중 - sessionKey: {}", sessionKey);
            return sessionKey;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("건강검진+예측 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강검진 요청 중 오류: " + e.getMessage(), e);
        }
    }

    /** 단일 API의 1차 요청 처리 → CheckupApiContext 반환 (실패해도 null 아님, code로 구분) */
    private CheckupApiContext fireFirstRequest(EasyCodef codef, String name, String apiUrl,
                                               HashMap<String, Object> params,
                                               EasyCodefServiceType svcType) {
        try {
            log.info("[{}] 1차 요청", name);
            String raw = codef.requestProduct(apiUrl, svcType, params);

            Map<String, Object> respMap = objectMapper.readValue(raw, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            log.info("[{}] 1차 응답 - code: {}", name, code);

            if ("CF-03002".equals(code)) {
                return new CheckupApiContext(name, apiUrl, params, code, toMap(respMap.get("data")), null);
            } else if ("CF-00000".equals(code)) {
                return new CheckupApiContext(name, apiUrl, params, code, null, raw);
            } else {
                log.warn("[{}] 1차 비정상 응답 - code: {}, message: {}", name, code, resultField.get("message"));
                return new CheckupApiContext(name, apiUrl, params, code, null, null);
            }
        } catch (Exception e) {
            log.warn("[{}] 1차 예외: {}", name, e.getMessage());
            return new CheckupApiContext(name, apiUrl, params, "EXCEPTION", null, null);
        }
    }

    @Transactional
    public CheckupStep2Result syncCheckupStep2(String sessionKey) {
        CheckupMultiSession session = getValidCheckupMultiSession(sessionKey);

        // 백그라운드 예측 futures 수집 (최대 70초 대기)
        // 실서버에서 건강나이/뇌졸중/당뇨/심뇌혈관 응답이 호출당 40초 이상 걸릴 수 있고,
        // 4개를 800ms 간격으로 발사하므로 마지막 응답까지 30초로는 부족 → 70초로 여유 확보.
        List<CompletableFuture<CheckupApiContext>> pending = session.getPendingPredictionFutures();
        if (pending != null && !pending.isEmpty()) {
            try {
                CompletableFuture.allOf(pending.toArray(new CompletableFuture[0])).get(70, TimeUnit.SECONDS);
            } catch (TimeoutException te) {
                log.warn("예측 백그라운드 future 일부 미완료 - 완료된 것만 수집");
            } catch (Exception ignored) {}

            for (CompletableFuture<CheckupApiContext> f : pending) {
                if (!f.isDone()) continue;
                try {
                    CheckupApiContext ctx = f.join();
                    if (ctx != null && ("CF-00000".equals(ctx.getFirstResponseCode())
                            || "CF-03002".equals(ctx.getFirstResponseCode()))) {
                        session.getApis().add(ctx);
                    } else {
                        String name = ctx != null ? ctx.getName() : "UNKNOWN";
                        session.getFailedPredictionsAtStep1().add(name);
                        log.warn("예측 1차 실패 - type: {}, code: {}", name,
                                ctx != null ? ctx.getFirstResponseCode() : "null");
                    }
                } catch (Exception e) {
                    session.getFailedPredictionsAtStep1().add("UNKNOWN");
                }
            }
        }

        // 건강검진 컨텍스트 우선 추출 + 인증/저장 (필수)
        CheckupApiContext checkupCtx = null;
        List<CheckupApiContext> predictionCtxs = new ArrayList<>();
        for (CheckupApiContext c : session.getApis()) {
            if (API_CHECKUP.equals(c.getName())) checkupCtx = c;
            else predictionCtxs.add(c);
        }
        if (checkupCtx == null) {
            throw new RuntimeException("세션에 건강검진 정보가 없습니다. 처음부터 다시 시도해주세요.");
        }

        int savedCheckups;
        try {
            String checkupResult = certifyOrUseRaw(checkupCtx);
            // 코드 검증
            Map<String, Object> respMap = objectMapper.readValue(checkupResult, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            if (!"CF-00000".equals(code)) {
                String msg = (String) resultField.getOrDefault("message", "건강검진 인증 실패");
                throw new RuntimeException("건강검진(NHIS) 인증 오류 [" + code + "]: " + msg);
            }
            savedCheckups = saveCheckupResults(session.getUserId(), checkupResult);
        } catch (RuntimeException e) {
            // 건강검진 실패 → 전체 실패 (트랜잭션 롤백)
            checkupMultiSessions.remove(sessionKey);
            throw e;
        } catch (Exception e) {
            checkupMultiSessions.remove(sessionKey);
            log.error("건강검진 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강검진 인증 중 오류: " + e.getMessage(), e);
        }

        // 예측 4개 개별 처리 (부분 실패 허용)
        int savedPredictions = 0;
        List<String> failedPredictions = new ArrayList<>(session.getFailedPredictionsAtStep1());

        for (CheckupApiContext pCtx : predictionCtxs) {
            try {
                String predResult = certifyOrUseRaw(pCtx);
                Map<String, Object> respMap = objectMapper.readValue(predResult, Map.class);
                Map<String, Object> resultField = toMap(respMap.get("result"));
                String code = (String) resultField.get("code");
                if (!"CF-00000".equals(code)) {
                    log.warn("[{}] 2차 비정상 응답 - code: {}", pCtx.getName(), code);
                    failedPredictions.add(pCtx.getName());
                    continue;
                }
                savePredictionResult(session.getUserId(), pCtx.getName(), predResult);
                savedPredictions++;
            } catch (Exception e) {
                log.warn("[{}] 2차 예외 - 건너뜀: {}", pCtx.getName(), e.getMessage());
                failedPredictions.add(pCtx.getName());
            }
        }

        checkupMultiSessions.remove(sessionKey);
        log.info("건강검진+예측 동기화 완료 - userId: {}, checkups: {}, predictions: {}, failed: {}",
                session.getUserId(), savedCheckups, savedPredictions, failedPredictions);
        return new CheckupStep2Result(savedCheckups, savedPredictions, failedPredictions);
    }

    /** CF-00000이면 rawResult 그대로, CF-03002면 requestCertification 호출 */
    private String certifyOrUseRaw(CheckupApiContext ctx) throws Exception {
        if ("CF-00000".equals(ctx.getFirstResponseCode()) && ctx.getRawResult() != null) {
            log.info("[{}] CF-00000 → 1차 응답 직접 사용", ctx.getName());
            return ctx.getRawResult();
        }
        HashMap<String, Object> certMap = new HashMap<>(ctx.getParams());
        certMap.put("twoWayInfo", buildTwoWayInfo(ctx.getTwoWayData()));
        certMap.put("is2Way",    true);
        certMap.put("simpleAuth","1");
        log.info("[{}] 2차 인증 요청", ctx.getName());
        String result = createCodef().requestCertification(ctx.getApiUrl(), serviceType(), certMap);
        return result;
    }

    private CheckupMultiSession getValidCheckupMultiSession(String sessionKey) {
        CheckupMultiSession s = checkupMultiSessions.get(sessionKey);
        if (s == null) throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        if (s.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            checkupMultiSessions.remove(sessionKey);
            throw new RuntimeException("인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return s;
    }

    /**
     * 예측 결과 1건 파싱 + 저장 (분기)
     * - HEALTH_AGE → saveHealthAgeResult
     * - STROKE / DIABETES / CARDIO → saveDiseasePrediction
     */
    private void savePredictionResult(Long userId, String predictionType, String rawResult) throws Exception {
        if (API_HEALTH_AGE.equals(predictionType)) {
            saveHealthAgeResult(userId, rawResult);
        } else {
            saveDiseasePrediction(userId, predictionType, rawResult);
        }
    }

    /**
     * 뇌졸중/당뇨/심뇌혈관: resDetailList(+resProgressList/resAverageList) + resCompareList까지 정규화 저장
     */
    @SuppressWarnings("unchecked")
    private void saveDiseasePrediction(Long userId, String predictionType, String rawResult) throws Exception {
        Map<String, Object> respMap = objectMapper.readValue(rawResult, Map.class);
        Map<String, Object> data = toMap(respMap.get("data"));

        LocalDate checkupDate = parseDate8(str(data.get("resCheckupDate")));

        // 같은 (userId, type) 기존 데이터 삭제 → 최신만 유지 (자식 cascade 정리됨)
        diseasePredictionRepo.deleteByUserIdAndPredictionType(userId, predictionType);

        DiseasePrediction pred = DiseasePrediction.builder()
                .userId(userId)
                .predictionType(predictionType)
                .checkupDate(checkupDate)
                .riskGrade(str(data.get("resRiskGrade")))
                .riskRatio(str(data.get("resRatio")))
                .averageRatio(str(data.get("resAverageRatio")))
                .averageAgeGroup(str(data.get("resAverageAge")))
                .build();

        // resDetailList → factors + 각 factor의 yearly (resProgressList + resAverageList 같은 year로 머지)
        List<DiseasePredictionFactor> factors = new ArrayList<>();
        List<Map<String, Object>> detailList = (List<Map<String, Object>>) data.getOrDefault("resDetailList", List.of());
        int factorIdx = 0;
        for (Map<String, Object> d : detailList) {
            DiseasePredictionFactor factor = DiseasePredictionFactor.builder()
                    .prediction(pred)
                    .riskFactor(str(d.get("resRiskFactor")))
                    .currentState(str(d.get("resState")))
                    .severityType(str(d.get("resType")))
                    .averageValue(str(d.get("resAverage")))
                    .sortOrder(factorIdx++)
                    .build();

            // resProgressList (본인 연도별) + resAverageList (평균 연도별)을 year 기준으로 머지
            List<Map<String, Object>> progressList = (List<Map<String, Object>>) d.getOrDefault("resProgressList", List.of());
            List<Map<String, Object>> averageList  = (List<Map<String, Object>>) d.getOrDefault("resAverageList",  List.of());

            Map<String, String> myByYear = new LinkedHashMap<>();
            for (Map<String, Object> p : progressList) {
                String y = str(p.get("resYear"));
                if (y != null) myByYear.put(y, str(p.get("resAmount")));
            }
            Map<String, String> avgByYear = new LinkedHashMap<>();
            for (Map<String, Object> a : averageList) {
                String y = str(a.get("resYear"));
                if (y != null) avgByYear.put(y, str(a.get("resAmount")));
            }

            // year 합집합 (progress 우선 정렬, 누락된 평균 year도 합치기)
            Set<String> allYears = new LinkedHashSet<>();
            allYears.addAll(myByYear.keySet());
            allYears.addAll(avgByYear.keySet());

            List<DiseasePredictionYearly> yearly = new ArrayList<>();
            for (String y : allYears) {
                yearly.add(DiseasePredictionYearly.builder()
                        .factor(factor)
                        .year(y)
                        .myAmount(myByYear.get(y))
                        .averageAmount(avgByYear.get(y))
                        .build());
            }
            factor.setYearly(yearly);
            factors.add(factor);
        }
        pred.setFactors(factors);

        // resCompareList → compares
        List<DiseasePredictionCompare> compares = new ArrayList<>();
        List<Map<String, Object>> compareList = (List<Map<String, Object>>) data.getOrDefault("resCompareList", List.of());
        for (Map<String, Object> c : compareList) {
            compares.add(DiseasePredictionCompare.builder()
                    .prediction(pred)
                    .year(str(c.get("resCheckupDate")))
                    .predictedState(str(c.get("resState")))
                    .build());
        }
        pred.setCompares(compares);

        diseasePredictionRepo.save(pred);  // cascade=ALL로 자식 함께 저장
        log.info("[{}] 저장 완료 - userId: {}, date: {}, factors: {}, compares: {}",
                predictionType, userId, checkupDate, factors.size(), compares.size());
    }

    /**
     * 건강나이: resAge/resChronologicalAge + resDetailList(텍스트형) 정규화 저장
     */
    @SuppressWarnings("unchecked")
    private void saveHealthAgeResult(Long userId, String rawResult) throws Exception {
        Map<String, Object> respMap = objectMapper.readValue(rawResult, Map.class);
        Map<String, Object> data = toMap(respMap.get("data"));

        LocalDate checkupDate = parseDate8(str(data.get("resCheckupDate")));

        // userId별 1건만 유지
        healthAgeResultRepo.deleteByUserId(userId);

        Integer biologicalAge   = parseIntSafe(data.get("resAge"));
        Integer chronologicalAge = parseIntSafe(data.get("resChronologicalAge"));

        // resDetailList 원문 그대로 JSON 직렬화하여 factors 컬럼에 보관
        Object detailList = data.getOrDefault("resDetailList", List.of());
        String factorsJson = objectMapper.writeValueAsString(detailList);

        HealthAgeResult result = HealthAgeResult.builder()
                .userId(userId)
                .checkupDate(checkupDate)
                .biologicalAge(biologicalAge)
                .chronologicalAge(chronologicalAge)
                .summaryNote(str(data.get("resNote")))
                .detailMessage(str(data.get("resNote1")))
                .changeAfterMessage(str(data.get("resChangeAfter")))
                .gender(str(data.get("resGender")))
                .height(parseDouble(data.get("resHeight")))
                .weight(parseDouble(data.get("resWeight")))
                .factors(factorsJson)
                .build();

        healthAgeResultRepo.save(result);
        int factorCount = (detailList instanceof List) ? ((List<?>) detailList).size() : 0;
        log.info("[HEALTH_AGE] 저장 완료 - userId: {}, date: {}, factors: {}",
                userId, checkupDate, factorCount);
    }

    private Integer parseIntSafe(Object o) {
        if (o == null) return null;
        String s = o.toString().trim().replaceAll("[^0-9-]", "");
        if (s.isEmpty()) return null;
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return null; }
    }

    // ── 진료정보(HIRA) 단독 ──────────────────────────────────────────────

    public String syncMedicalStep1(Long userId, String userName, String phoneNo,
                                   String identity13, String telecom, String loginTypeLevel) {
        try {
            String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

            HashMap<String, Object> params = new HashMap<>();
            params.put("organization",   "0020");
            params.put("loginType",      "5");
            params.put("loginTypeLevel", loginTypeLevel);
            params.put("userName",       userName);
            params.put("phoneNo",        phoneNo);
            params.put("identity",       identity13);
            params.put("startDate",      "20230101");
            params.put("endDate",        today);
            params.put("id",             "mc_hira_" + userId);
            if ("5".equals(loginTypeLevel)) params.put("telecom", telecom);

            log.info("HIRA 진료정보 1차 요청 - userId: {}", userId);
            String result = createCodef().requestProduct(HIRA_URL, serviceType(), params);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            log.info("HIRA 진료정보 1차 응답 - code: {}", code);
            if (!"CF-00000".equals(code) && !"CF-03002".equals(code)) {
                String msg = (String) resultField.getOrDefault("message", "진료정보 조회 실패");
                throw new RuntimeException("진료정보(HIRA) 오류 [" + code + "]: " + msg);
            }

            String sessionKey = UUID.randomUUID().toString();
            singleSessions.put(sessionKey, new SingleSession(userId, params, toMap(respMap.get("data")), LocalDateTime.now()));
            log.info("HIRA 진료정보 1차 완료 - sessionKey: {}", sessionKey);
            return sessionKey;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("HIRA 진료정보 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("진료정보 요청 중 오류: " + e.getMessage(), e);
        }
    }

    @Transactional
    public int[] syncMedicalStep2(String sessionKey) {
        SingleSession session = getValidSingleSession(sessionKey);
        try {
            HashMap<String, Object> certMap = new HashMap<>(session.getParams());
            certMap.put("twoWayInfo", new HashMap<>(session.getTwoWayData()));
            certMap.put("is2Way",    true);
            certMap.put("simpleAuth","1");

            log.info("HIRA 진료정보 2차 요청 - sessionKey: {}", sessionKey);
            String result = createCodef().requestCertification(HIRA_URL, serviceType(), certMap);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            log.info("HIRA 진료정보 2차 응답 - code: {}", code);
            if (!"CF-00000".equals(code)) {
                if ("CF-03002".equals(code)) {
                    throw new RuntimeException("앱 인증이 아직 완료되지 않았습니다. 인증 앱에서 승인 후 다시 눌러주세요.");
                }
                String msg = (String) resultField.getOrDefault("message", "진료정보 인증 실패");
                throw new RuntimeException("진료정보(HIRA) 인증 오류 [" + code + "]: " + msg);
            }

            int[] counts = saveMedicalData(session.getUserId(), result);
            singleSessions.remove(sessionKey);
            log.info("HIRA 진료정보 동기화 완료 - userId: {}, medicals: {}, medications: {}",
                    session.getUserId(), counts[0], counts[1]);
            return counts;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("HIRA 진료정보 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("진료정보 인증 중 오류: " + e.getMessage(), e);
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

    /** 건강검진 + 예측 4개 API 컨텍스트 */
    @Data
    @AllArgsConstructor
    private static class CheckupApiContext {
        private String name;                    // CHECKUP / HEALTH_AGE / STROKE / DIABETES / CARDIO
        private String apiUrl;
        private HashMap<String, Object> params; // 1차 요청 파라미터 (2차에 재사용)
        private String firstResponseCode;       // CF-00000 / CF-03002 / 기타
        private Map<String, Object> twoWayData; // CF-03002일 때만
        private String rawResult;               // CF-00000일 때 1차 응답
    }

    @Data
    @AllArgsConstructor
    private static class CheckupMultiSession {
        private Long userId;
        private List<CheckupApiContext> apis;            // 건강검진 + 성공한 예측들
        private List<String> failedPredictionsAtStep1;   // 1차에서 실패한 예측 타입
        private List<CompletableFuture<CheckupApiContext>> pendingPredictionFutures; // 백그라운드 예측 futures
        private LocalDateTime createdAt;
    }

    @Data
    @AllArgsConstructor
    public static class CheckupStep2Result {
        private int savedCheckups;
        private int savedPredictions;
        private List<String> failedPredictions;
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
