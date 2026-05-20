package com.medicatch.health.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.health.entity.CheckupResult;
import com.medicatch.health.entity.HealthPrediction;
import com.medicatch.health.entity.MedicalRecord;
import com.medicatch.health.entity.MedicationDetail;
import com.medicatch.health.repository.CheckupResultRepository;
import com.medicatch.health.repository.HealthPredictionRepository;
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
    private static final String NTS_URL  = "/v1/kr/public/nt/etc-yearend-tax/income-tax-credit";
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
    private final HealthPredictionRepository healthPredictionRepo;
    private final ConcurrentHashMap<String, SyncSession>                              sessions         = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<NtsYearSession>>                     ntsMultiSessions = new ConcurrentHashMap<>();
    /** step1에서 20초 내 미완료된 NTS futures → step2에서 사용자 인증 후 수집 */
    private final ConcurrentHashMap<String, List<CompletableFuture<NtsYearSession>>>  pendingNtsFutures = new ConcurrentHashMap<>();
    /** 건강검진 + 예측 4개 멀티 세션 (sessionKey → 5개 API 컨텍스트) */
    private final ConcurrentHashMap<String, CheckupMultiSession>                      checkupMultiSessions = new ConcurrentHashMap<>();

    public CodefSyncService(ObjectMapper objectMapper,
                            MedicalRecordRepository medicalRecordRepo,
                            CheckupResultRepository checkupResultRepo,
                            MedicationDetailRepository medicationDetailRepo,
                            HealthPredictionRepository healthPredictionRepo) {
        this.objectMapper = objectMapper;
        this.medicalRecordRepo = medicalRecordRepo;
        this.checkupResultRepo = checkupResultRepo;
        this.medicationDetailRepo = medicationDetailRepo;
        this.healthPredictionRepo = healthPredictionRepo;
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

            // NTS 연말정산 다건 인증: 2023 ~ 현재연도 병렬 요청 (같은 id로 1회 인증)
            String[] ntsYears = buildNtsYears();
            List<CompletableFuture<NtsYearSession>> ntsFutures = new ArrayList<>();
            for (String ntsYear : ntsYears) {
                HashMap<String, Object> p = buildNtsParams(userName, phoneNo, identity13, ntsYear, loginTypeLevel, telecom);
                p.put("id", sharedId);
                ntsFutures.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        log.info("NTS 연말정산 1차 요청 {} - userId: {}", ntsYear, userId);
                        String r = createCodef().requestProduct(NTS_URL, svcType, p);
                        Map<String, Object> m = objectMapper.readValue(r, Map.class);
                        String c = (String) toMap(m.get("result")).get("code");
                        if ("CF-00000".equals(c) || "CF-03002".equals(c))
                            return new NtsYearSession(ntsYear, p, toMap(m.get("data")), c,
                                    "CF-00000".equals(c) ? r : null);
                        log.warn("NTS {} 1차 오류 [{}]", ntsYear, c);
                        return null;
                    } catch (Exception e) {
                        log.warn("NTS {} 1차 실패: {}", ntsYear, e.getMessage()); return null;
                    }
                }));
            }

            String nhisResult = nhisFuture.get(90, TimeUnit.SECONDS);
            String hiraResult = hiraFuture.get(90, TimeUnit.SECONDS);
            log.info("NHIS 1차 응답: {}", nhisResult);
            log.info("HIRA 1차 응답: {}", hiraResult);

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

            // anyOf: 첫 번째 완료까지 최대 20초 대기, 이후 완료된 것 모두 수집
            // 미완료 futures는 cancel하지 않고 pendingNtsFutures에 보관 → step2에서 사용자 인증 후 수집
            List<NtsYearSession> ntsYearSessions = new ArrayList<>();
            List<CompletableFuture<NtsYearSession>> ntsPendingFutures = new ArrayList<>();
            CompletableFuture<Object> ntsAnyDone = CompletableFuture.anyOf(
                ntsFutures.toArray(new CompletableFuture[0]));
            try {
                ntsAnyDone.get(20, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                log.warn("NTS 통합 1차 - 20초 내 응답 없음");
            } catch (Exception ignored) {}
            for (CompletableFuture<NtsYearSession> f : ntsFutures) {
                if (!f.isDone()) { ntsPendingFutures.add(f); continue; }
                try { NtsYearSession s = f.join(); if (s != null) ntsYearSessions.add(s); }
                catch (Exception ignored) {}
            }

            String sessionKey = UUID.randomUUID().toString();
            sessions.put(sessionKey, new SyncSession(
                    userId, nhisParams, nhisData, hiraParams, hiraData,
                    ntsYearSessions, loginTypeLevel, LocalDateTime.now()
            ));
            if (!ntsPendingFutures.isEmpty()) pendingNtsFutures.put(sessionKey, ntsPendingFutures);

            log.info("건강 데이터 동기화 1차 완료 - sessionKey: {}, ntsYears: {}", sessionKey, ntsYearSessions.size());
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
            int checkupCount = 0, medicalCount = 0, medicationCount = 0, nonCoveredCount = 0;

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

            // 연말정산 2차: 연도별 다건 인증 (1차에 성공한 연도만)
            for (NtsYearSession nts : session.getNtsYearSessions()) {
                try {
                    if ("CF-00000".equals(nts.getCode()) && nts.getRawResult() != null) {
                        // 1차에서 직접 데이터 수신 - 재인증 불필요
                        log.info("NTS 연말정산 {} - CF-00000 직접 저장", nts.getYear());
                        nonCoveredCount += updateNonCoveredAmounts(session.getUserId(), nts.getRawResult());
                    } else {
                        Thread.sleep(200);
                        HashMap<String, Object> ntsCertMap = new HashMap<>(nts.getParams());
                        ntsCertMap.put("twoWayInfo", buildTwoWayInfo(nts.getTwoWayData()));
                        ntsCertMap.put("is2Way",    true);
                        ntsCertMap.put("simpleAuth","1");

                        log.info("NTS 연말정산 {} 2차 요청", nts.getYear());
                        String ntsResult = createCodef().requestCertification(NTS_URL, serviceType(), ntsCertMap);
                        log.debug("NTS {} 2차 응답: {}", nts.getYear(), ntsResult);
                        nonCoveredCount += updateNonCoveredAmounts(session.getUserId(), ntsResult);
                    }
                } catch (Exception e) {
                    log.warn("NTS {} 2차 실패 - 건너뜀: {}", nts.getYear(), e.getMessage());
                }
            }

            // 1차에서 미완료된 NTS futures 수집 (사용자 인증 완료 후 CF-00000으로 도착)
            List<CompletableFuture<NtsYearSession>> ntsPending = pendingNtsFutures.remove(sessionKey);
            if (ntsPending != null && !ntsPending.isEmpty()) {
                CompletableFuture<Void> allPending = CompletableFuture.allOf(ntsPending.toArray(new CompletableFuture[0]));
                try { allPending.get(30, TimeUnit.SECONDS); }
                catch (TimeoutException e) { log.warn("NTS pending futures 30초 초과 - 일부 연도 저장 누락 가능"); }
                catch (Exception ignored) {}
                for (CompletableFuture<NtsYearSession> f : ntsPending) {
                    if (!f.isDone()) { f.cancel(false); continue; }
                    try {
                        NtsYearSession s = f.join();
                        if (s != null && "CF-00000".equals(s.getCode()) && s.getRawResult() != null) {
                            log.info("NTS pending {} 저장", s.getYear());
                            nonCoveredCount += updateNonCoveredAmounts(session.getUserId(), s.getRawResult());
                        }
                    } catch (Exception ignored) {}
                }
            }

            sessions.remove(sessionKey);
            log.info("건강 데이터 동기화 완료 - userId: {}, checkups: {}, medicals: {}, medications: {}, nonCovered: {}",
                    session.getUserId(), checkupCount, medicalCount, medicationCount, nonCoveredCount);

            return new SyncStep2Result(checkupCount, medicalCount, medicationCount, nonCoveredCount);

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

            // SSO 그룹핑: 5개 API는 단일 EasyCodef 인스턴스 + 800ms 간격 순차 발사로 묶어야
            // CODEF 서버가 같은 SSO id로 그룹핑 (인증 push 1회만 발생).
            // 병렬 발사하거나 인스턴스를 분리하면 각각 별도 세션이 생성되어 push가 5회 옴.
            final EasyCodef sharedCodef = createCodef();

            // 건강검진 future (필수, 가장 먼저 발사)
            CompletableFuture<CheckupApiContext> checkupFuture = CompletableFuture.supplyAsync(() ->
                    fireFirstRequest(sharedCodef, API_CHECKUP, NHIS_URL, checkupParams, svcType));

            // 예측 4개 future (각각 800ms 지연 후 발사)
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
                }));
            }

            // 1) 건강검진 응답 우선 대기 (최대 90초) — 필수이므로 충분히 기다림
            CheckupApiContext checkupCtx;
            try {
                checkupCtx = checkupFuture.get(90, TimeUnit.SECONDS);
            } catch (TimeoutException te) {
                throw new RuntimeException("건강검진(NHIS) 오류 [TIMEOUT]: 응답이 너무 늦어 다시 시도해주세요.");
            } catch (Exception e) {
                throw new RuntimeException("건강검진(NHIS) 오류 [EXCEPTION]: " + e.getMessage(), e);
            }

            // 건강검진 응답코드 검증 (옵션 B)
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

            // 2) 예측 4개 결과 수집 — 건강검진 완료 후 추가로 최대 30초 더 대기
            try {
                CompletableFuture.allOf(predictionFutures.toArray(new CompletableFuture[0]))
                        .get(30, TimeUnit.SECONDS);
            } catch (TimeoutException te) {
                log.warn("예측 API 일부 타임아웃 - 완료된 것만 수집");
            } catch (Exception ignored) {}

            List<CheckupApiContext> predictionCtxs = new ArrayList<>();
            List<String> failedAtStep1 = new ArrayList<>();
            for (int i = 0; i < predictionFutures.size(); i++) {
                CompletableFuture<CheckupApiContext> f = predictionFutures.get(i);
                String pName = predictionTypes[i];
                CheckupApiContext ctx = null;
                if (f.isDone()) {
                    try { ctx = f.join(); } catch (Exception ignored) {}
                }
                if (ctx == null) {
                    failedAtStep1.add(pName);
                    continue;
                }
                if ("CF-00000".equals(ctx.getFirstResponseCode())
                 || "CF-03002".equals(ctx.getFirstResponseCode())) {
                    predictionCtxs.add(ctx);
                } else {
                    failedAtStep1.add(pName);
                    log.warn("예측 1차 실패 - type: {}, code: {}", pName, ctx.getFirstResponseCode());
                }
            }

            // 세션 구성
            List<CheckupApiContext> allApis = new ArrayList<>();
            allApis.add(checkupCtx);
            allApis.addAll(predictionCtxs);

            String sessionKey = UUID.randomUUID().toString();
            checkupMultiSessions.put(sessionKey,
                    new CheckupMultiSession(userId, allApis, failedAtStep1, LocalDateTime.now()));
            log.info("건강검진+예측 1차 완료 - sessionKey: {}, 수집: {}, 1차실패: {}",
                    sessionKey, allApis.size(), failedAtStep1);
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
            log.debug("[{}] 1차 응답: {}", name, raw);

            Map<String, Object> respMap = objectMapper.readValue(raw, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");

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
        log.debug("[{}] 2차 응답: {}", ctx.getName(), result);
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
     * 예측 결과 1건 파싱 + 저장
     * - 뇌졸중/당뇨/심뇌혈관: resRiskGrade, resRatio, resAverageAge, resAverageRatio
     * - 건강나이(HEALTH_AGE): 응답 구조 다름 → resAge(건강나이), resChronologicalAge(실제나이) 매핑
     */
    @SuppressWarnings("unchecked")
    private void savePredictionResult(Long userId, String predictionType, String rawResult) throws Exception {
        Map<String, Object> respMap = objectMapper.readValue(rawResult, Map.class);
        Map<String, Object> data = toMap(respMap.get("data"));

        LocalDate checkupDate = parseDate8(str(data.get("resCheckupDate")));

        String riskGrade, riskRatio, averageAge, averageRatio;
        if (API_HEALTH_AGE.equals(predictionType)) {
            // 건강나이는 등급/비율 개념 없음 → resAge/resChronologicalAge만 핵심
            riskGrade    = null;
            riskRatio    = str(data.get("resAge"));               // 건강나이
            averageAge   = str(data.get("resChronologicalAge"));  // 실제나이
            averageRatio = null;
        } else {
            riskGrade    = str(data.get("resRiskGrade"));
            riskRatio    = str(data.get("resRatio"));
            averageAge   = str(data.get("resAverageAge"));
            averageRatio = str(data.get("resAverageRatio"));
        }

        // 같은 (userId, type) 기존 데이터 삭제 → 최신만 유지
        healthPredictionRepo.deleteByUserIdAndPredictionType(userId, predictionType);

        HealthPrediction pred = HealthPrediction.builder()
                .userId(userId)
                .predictionType(predictionType)
                .checkupDate(checkupDate)
                .riskGrade(riskGrade)
                .riskRatio(riskRatio)
                .averageAge(averageAge)
                .averageRatio(averageRatio)
                .rawJson(rawResult)
                .build();
        healthPredictionRepo.save(pred);
        log.info("[{}] 저장 완료 - userId: {}, date: {}", predictionType, userId, checkupDate);
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
            log.info("HIRA 진료정보 1차 응답: {}", result);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
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
            log.info("HIRA 진료정보 2차 응답: {}", result);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            if (!"CF-00000".equals(code)) {
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

    // ── 연말정산(NTS) 단독 – 다건 인증 (2023 ~ 현재연도) ──────────────────

    public String syncYeartaxStep1(Long userId, String userName, String phoneNo,
                                   String identity13, String telecom, String loginTypeLevel) {
        try {
            String sharedId = "mc_nts_" + userId;
            String[] years  = buildNtsYears();
            EasyCodefServiceType svcType = serviceType();

            // 연도별 병렬 1차 요청 (같은 id → 사용자는 1회 인증)
            List<CompletableFuture<NtsYearSession>> futures = new ArrayList<>();
            for (String year : years) {
                HashMap<String, Object> p = buildNtsParams(userName, phoneNo, identity13, year, loginTypeLevel, telecom);
                p.put("id", sharedId);
                futures.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        log.info("NTS 연말정산 단독 1차 {} - userId: {}", year, userId);
                        String r = createCodef().requestProduct(NTS_URL, svcType, p);
                        log.error("NTS {} 1차 응답 전문: {}", year, r);
                        Map<String, Object> m = objectMapper.readValue(r, Map.class);
                        Map<String, Object> resultField = toMap(m.get("result"));
                        String c = (String) resultField.get("code");
                        String msg = (String) resultField.getOrDefault("message", "");
                        if ("CF-00000".equals(c) || "CF-03002".equals(c))
                            return new NtsYearSession(year, p, toMap(m.get("data")), c,
                                    "CF-00000".equals(c) ? r : null);
                        log.error("NTS 단독 {} 1차 오류 [{}] - {}", year, c, msg); return null;
                    } catch (Exception e) {
                        log.error("NTS 단독 {} 1차 예외: {}", year, e.getMessage(), e); return null;
                    }
                }));
            }

            // anyOf: 첫 번째 완료까지 최대 20초 대기, 이후 완료된 것 모두 수집
            // 미완료 futures는 cancel하지 않고 pendingNtsFutures에 보관 → step2에서 사용자 인증 후 수집
            List<NtsYearSession> yearSessions = new ArrayList<>();
            List<CompletableFuture<NtsYearSession>> yeartaxPendingFutures = new ArrayList<>();
            CompletableFuture<Object> anyDone = CompletableFuture.anyOf(
                futures.toArray(new CompletableFuture[0]));
            try {
                anyDone.get(20, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                log.warn("NTS 단독 1차 - 20초 내 응답 없음, 완료된 연도만 수집");
            } catch (Exception ignored) {}
            for (CompletableFuture<NtsYearSession> f : futures) {
                if (!f.isDone()) { yeartaxPendingFutures.add(f); continue; }
                try { NtsYearSession s = f.join(); if (s != null) yearSessions.add(s); }
                catch (Exception ignored) {}
            }
            if (yearSessions.isEmpty()) {
                log.error("NTS 연말정산 단독 1차 - 모든 연도 실패. userId: {}, years: {}", userId, years);
                throw new RuntimeException("연말정산 데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.");
            }
            log.info("NTS 1차 완료 - 수집된 연도: {}", yearSessions.stream().map(NtsYearSession::getYear).toList());

            String sessionKey = UUID.randomUUID().toString();
            ntsMultiSessions.put(sessionKey, yearSessions);
            if (!yeartaxPendingFutures.isEmpty()) pendingNtsFutures.put(sessionKey, yeartaxPendingFutures);
            log.info("NTS 연말정산 단독 1차 완료 - sessionKey: {}, years: {}", sessionKey, yearSessions.size());
            return sessionKey;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NTS 연말정산 단독 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("연말정산 요청 중 오류: " + e.getMessage(), e);
        }
    }

    @Transactional
    public int syncYeartaxStep2(String sessionKey) {
        List<NtsYearSession> yearSessions = ntsMultiSessions.get(sessionKey);
        if (yearSessions == null || yearSessions.isEmpty())
            throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");

        Long userId = yearSessions.get(0).getParams() != null
                ? Long.parseLong(yearSessions.get(0).getParams()
                    .getOrDefault("id", "mc_nts_0").toString().replace("mc_nts_", ""))
                : null;
        if (userId == null) throw new RuntimeException("세션에서 userId를 확인할 수 없습니다.");

        int totalUpdated = 0;
        try {
            for (NtsYearSession nts : yearSessions) {
                try {
                    if ("CF-00000".equals(nts.getCode()) && nts.getRawResult() != null) {
                        // 1차에서 직접 데이터 수신 - 재인증 불필요
                        log.info("NTS 연말정산 단독 {} - CF-00000 직접 저장", nts.getYear());
                        totalUpdated += updateNonCoveredAmounts(userId, nts.getRawResult());
                    } else {
                        HashMap<String, Object> certMap = new HashMap<>(nts.getParams());
                        certMap.put("twoWayInfo", buildTwoWayInfo(nts.getTwoWayData()));
                        certMap.put("is2Way",    true);
                        certMap.put("simpleAuth","1");

                        log.info("NTS 연말정산 단독 {} 2차 요청", nts.getYear());
                        String result = createCodef().requestCertification(NTS_URL, serviceType(), certMap);
                        log.debug("NTS {} 2차 응답: {}", nts.getYear(), result);

                        Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
                        Map<String, Object> resultField = toMap(respMap.get("result"));
                        String code = (String) resultField.get("code");
                        if ("CF-00000".equals(code))
                            totalUpdated += updateNonCoveredAmounts(userId, result);
                        else
                            log.warn("NTS {} 인증 오류 [{}]", nts.getYear(), code);
                    }
                } catch (Exception e) {
                    log.warn("NTS {} 2차 실패 - 건너뜀: {}", nts.getYear(), e.getMessage());
                }
            }

            // 1차에서 미완료된 NTS futures 수집 (사용자 인증 완료 후 CF-00000으로 도착)
            List<CompletableFuture<NtsYearSession>> ytPending = pendingNtsFutures.remove(sessionKey);
            if (ytPending != null && !ytPending.isEmpty()) {
                CompletableFuture<Void> allPending = CompletableFuture.allOf(ytPending.toArray(new CompletableFuture[0]));
                try { allPending.get(30, TimeUnit.SECONDS); }
                catch (TimeoutException e) { log.warn("NTS pending futures 30초 초과 - 일부 연도 저장 누락 가능"); }
                catch (Exception ignored) {}
                for (CompletableFuture<NtsYearSession> f : ytPending) {
                    if (!f.isDone()) { f.cancel(false); continue; }
                    try {
                        NtsYearSession s = f.join();
                        if (s != null && "CF-00000".equals(s.getCode()) && s.getRawResult() != null) {
                            log.info("NTS pending {} 저장", s.getYear());
                            totalUpdated += updateNonCoveredAmounts(userId, s.getRawResult());
                        }
                    } catch (Exception ignored) {}
                }
            }

            ntsMultiSessions.remove(sessionKey);
            log.info("NTS 연말정산 단독 동기화 완료 - userId: {}, updated: {}", userId, totalUpdated);
            return totalUpdated;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NTS 연말정산 단독 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("연말정산 인증 중 오류: " + e.getMessage(), e);
        }
    }

    /**
     * NTS 연말정산 파라미터 생성.
     * API 문서상 loginType="6"(비회원 간편인증)이나, 실제 CODEF 서버가 CF-12401(reqLoginType :: undefined) 반환.
     * loginType="5"(회원 간편인증) + loginTypeLevel 방식이 실제로 동작함.
     * inquiryTypeCD: 의료비(index 3)만 조회 → "000100000000000"
     */
    private HashMap<String, Object> buildNtsParams(String userName, String phoneNo,
                                                    String identity13, String searchYear,
                                                    String loginTypeLevel, String telecom) {
        HashMap<String, Object> params = new HashMap<>();
        params.put("organization",    "0004");
        params.put("loginType",       "5");
        params.put("loginTypeLevel",  loginTypeLevel);
        params.put("userName",        userName);
        params.put("phoneNo",         phoneNo);
        params.put("identity",        identity13);
        params.put("searchStartYear", searchYear);
        params.put("inquiryTypeCD",   "000100000000000");  // 의료비만 조회
        if ("5".equals(loginTypeLevel)) params.put("telecom", telecom);
        return params;
    }

    /** HIRA 시작연도(2023) ~ 현재연도 배열 반환 */
    private String[] buildNtsYears() {
        int startYear   = 2023;
        int currentYear = LocalDate.now().getYear() - 1; // 전년도까지만 (당해연도 간소화 자료 미제공)
        List<String> years = new ArrayList<>();
        for (int y = currentYear; y >= startYear; y--) years.add(String.valueOf(y)); // 최신연도 우선
        return years.toArray(new String[0]);
    }

    /**
     * 연말정산 응답의 resBasicList → resDetailList를 파싱하여
     * 날짜+병원명 기준으로 MedicalRecord.nonCoveredAmount를 업데이트한다.
     * 비급여 = 연말정산 resAmount - HIRA outOfPocket (resDeductibleAmt)
     */
    @SuppressWarnings("unchecked")
    private int updateNonCoveredAmounts(Long userId, String ntsResult) throws Exception {
        Map<String, Object> responseMap = objectMapper.readValue(ntsResult, Map.class);
        Map<String, Object> resultField = toMap(responseMap.get("result"));
        String code = (String) resultField.get("code");
        if (!"CF-00000".equals(code)) {
            log.warn("연말정산 응답 오류 [{}] - 비급여 업데이트 건너뜀", code);
            return 0;
        }

        Map<String, Object> data = toMap(responseMap.get("data"));
        List<Map<String, Object>> basicList =
                (List<Map<String, Object>>) data.getOrDefault("resBasicList", List.of());

        // 날짜+병원명(정규화) → 연말정산 환자 납부액 매핑
        Map<String, Double> ytByDateHospital = new HashMap<>();
        // 날짜만으로도 집계 (병원명 불일치 대비 fallback)
        Map<String, List<Double>> ytByDate = new HashMap<>();

        for (Map<String, Object> basic : basicList) {
            if ("1".equals(str(basic.get("resType")))) continue; // 보험급여(실손보험 등) 항목 제외
            String companyNm = str(basic.get("resCompanyNm"));
            List<Map<String, Object>> detailList =
                    (List<Map<String, Object>>) basic.getOrDefault("resDetailList", List.of());
            for (Map<String, Object> detail : detailList) {
                String dateStr = str(detail.get("resDatePayment"));
                Double amt     = parseDouble(detail.get("resAmount"));
                if (dateStr == null || dateStr.length() < 8 || amt == null || amt <= 0) continue;
                String date8 = dateStr.substring(0, 8);

                String key = date8 + "::" + normalizeHospital(companyNm);
                ytByDateHospital.merge(key, amt, Double::sum);
                ytByDate.computeIfAbsent(date8, k -> new ArrayList<>()).add(amt);
            }
        }

        List<MedicalRecord> records = medicalRecordRepo.findByUserIdOrderByVisitDateDesc(userId);
        int updated = 0;
        for (MedicalRecord rec : records) {
            if (rec.getVisitDate() == null || rec.getOutOfPocket() == null) continue;
            String date8 = rec.getVisitDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

            Double ytAmount = ytByDateHospital.get(date8 + "::" + normalizeHospital(rec.getHospital()));

            // fallback: 해당 날짜에 단 하나의 병원 항목만 있을 때
            if (ytAmount == null) {
                List<Double> dayAmounts = ytByDate.get(date8);
                if (dayAmounts != null && dayAmounts.size() == 1) ytAmount = dayAmounts.get(0);
            }

            if (ytAmount != null) {
                double nonCovered = Math.max(0.0, ytAmount - rec.getOutOfPocket());
                rec.setNonCoveredAmount(nonCovered);
                updated++;
            }
        }
        medicalRecordRepo.saveAll(records);
        return updated;
    }

    private String normalizeHospital(String name) {
        if (name == null) return "";
        return name.replaceAll("\\s+", "").toLowerCase();
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
        private int updatedNonCovered;
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
        private LocalDateTime createdAt;
    }

    @Data
    @AllArgsConstructor
    public static class CheckupStep2Result {
        private int savedCheckups;
        private int savedPredictions;
        private List<String> failedPredictions;
    }

    /** 연말정산 단년도 요청 세션 (params + 2차 twoWayData) */
    @Data
    @AllArgsConstructor
    static class NtsYearSession {
        private String year;
        private HashMap<String, Object> params;
        private Map<String, Object> twoWayData;
        /** "CF-00000" (데이터 직접 수신) 또는 "CF-03002" (2차 인증 필요) */
        private String code;
        /** CF-00000 응답 시 raw JSON 보관 → step2에서 직접 저장. CF-03002이면 null */
        private String rawResult;
    }

    @Data
    @AllArgsConstructor
    private static class SyncSession {
        private Long userId;
        private HashMap<String, Object> nhisParams;
        private Map<String, Object> nhisTwoWayData;
        private HashMap<String, Object> hiraParams;
        private Map<String, Object> hiraTwoWayData;
        /** 연말정산 다건 인증: 연도별 세션 목록. NTS 실패 시 빈 리스트 */
        private List<NtsYearSession> ntsYearSessions;
        private String authMethod;
        private LocalDateTime createdAt;
    }
}
