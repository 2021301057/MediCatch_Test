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
import java.util.concurrent.TimeoutException;

@Slf4j
@Service
public class CodefSyncService {

    private static final String NHIS_URL         = "/v1/kr/public/pp/nhis-health-checkup/result";
    private static final String HIRA_URL         = "/v1/kr/public/hw/hira-list/my-medical-information";
    private static final String NTS_URL          = "/v1/kr/public/nt/etc-yearend-tax/income-tax-credit";
    private static final int    SESSION_TIMEOUT_MINUTES = 10;
    private static final String NHIS_START_YEAR  = "2020";
    private static final String HIRA_START_DATE  = "20230101";
    private static final int    NTS_START_YEAR   = 2023;

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

    private final ConcurrentHashMap<String, SingleSession>                             singleSessions    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, NtsMultiSession>                           ntsMultiSessions  = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, List<CompletableFuture<NtsYearSession>>>   pendingNtsFutures = new ConcurrentHashMap<>();

    public CodefSyncService(ObjectMapper objectMapper,
                            MedicalRecordRepository medicalRecordRepo,
                            CheckupResultRepository checkupResultRepo,
                            MedicationDetailRepository medicationDetailRepo) {
        this.objectMapper = objectMapper;
        this.medicalRecordRepo = medicalRecordRepo;
        this.checkupResultRepo = checkupResultRepo;
        this.medicationDetailRepo = medicationDetailRepo;
    }

    // ── 건강검진(NHIS) ────────────────────────────────────────────────────

    public String syncCheckupStep1(Long userId, String userName, String phoneNo,
                                   String identity13, String telecom, String loginTypeLevel) {
        try {
            String currentYear = String.valueOf(LocalDate.now().getYear());

            HashMap<String, Object> params = new HashMap<>();
            params.put("organization",    "0002");
            params.put("loginType",       "5");
            params.put("loginTypeLevel",  loginTypeLevel);
            params.put("userName",        userName);
            params.put("phoneNo",         phoneNo);
            params.put("identity",        deriveIdentity8(identity13));
            params.put("searchStartYear", NHIS_START_YEAR);
            params.put("searchEndYear",   currentYear);
            params.put("id",              "mc_nhis_" + userId);
            if ("5".equals(loginTypeLevel)) params.put("telecom", telecom);

            log.info("NHIS 건강검진 1차 요청 - userId: {}", userId);
            String result = createCodef().requestProduct(NHIS_URL, serviceType(), params);
            log.info("NHIS 건강검진 1차 응답: {}", result);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            if (!"CF-00000".equals(code) && !"CF-03002".equals(code)) {
                String msg = (String) resultField.getOrDefault("message", "건강검진 조회 실패");
                throw new RuntimeException("건강검진(NHIS) 오류 [" + code + "]: " + msg);
            }

            String sessionKey = UUID.randomUUID().toString();
            singleSessions.put(sessionKey, new SingleSession(userId, params, toMap(respMap.get("data")), LocalDateTime.now()));
            log.info("NHIS 건강검진 1차 완료 - sessionKey: {}", sessionKey);
            return sessionKey;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NHIS 건강검진 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강검진 요청 중 오류: " + e.getMessage(), e);
        }
    }

    @Transactional
    public int syncCheckupStep2(String sessionKey) {
        SingleSession session = getValidSingleSession(sessionKey);
        try {
            HashMap<String, Object> certMap = new HashMap<>(session.getParams());
            certMap.put("twoWayInfo", new HashMap<>(session.getTwoWayData()));
            certMap.put("is2Way",    true);
            certMap.put("simpleAuth","1");

            log.info("NHIS 건강검진 2차 요청 - sessionKey: {}", sessionKey);
            String result = createCodef().requestCertification(NHIS_URL, serviceType(), certMap);
            log.info("NHIS 건강검진 2차 응답: {}", result);

            Map<String, Object> respMap     = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = toMap(respMap.get("result"));
            String code = (String) resultField.get("code");
            if (!"CF-00000".equals(code)) {
                String msg = (String) resultField.getOrDefault("message", "건강검진 인증 실패");
                throw new RuntimeException("건강검진(NHIS) 인증 오류 [" + code + "]: " + msg);
            }

            int count = saveCheckupResults(session.getUserId(), result);
            singleSessions.remove(sessionKey);
            log.info("NHIS 건강검진 동기화 완료 - userId: {}, count: {}", session.getUserId(), count);
            return count;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NHIS 건강검진 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("건강검진 인증 중 오류: " + e.getMessage(), e);
        }
    }

    // ── 진료정보(HIRA) ────────────────────────────────────────────────────

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
            params.put("startDate",      HIRA_START_DATE);
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

    // ── 연말정산(NTS) ─────────────────────────────────────────────────────

    public String syncYeartaxStep1(Long userId, String userName, String phoneNo,
                                   String identity13, String telecom, String loginTypeLevel) {
        try {
            String sharedId  = "mc_nts_" + userId;
            String[] years   = buildNtsYears();
            EasyCodefServiceType svcType = serviceType();

            List<CompletableFuture<NtsYearSession>> futures = new ArrayList<>();
            for (String year : years) {
                HashMap<String, Object> p = buildNtsParams(userName, phoneNo, identity13, year, loginTypeLevel, telecom);
                p.put("id", sharedId);
                futures.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        log.info("NTS 연말정산 1차 {} - userId: {}", year, userId);
                        String r = createCodef().requestProduct(NTS_URL, svcType, p);
                        Map<String, Object> m = objectMapper.readValue(r, Map.class);
                        Map<String, Object> resultField = toMap(m.get("result"));
                        String c   = (String) resultField.get("code");
                        String msg = (String) resultField.getOrDefault("message", "");
                        if ("CF-00000".equals(c) || "CF-03002".equals(c))
                            return new NtsYearSession(year, p, toMap(m.get("data")), c,
                                    "CF-00000".equals(c) ? r : null);
                        log.warn("NTS {} 1차 오류 [{}] - {}", year, c, msg);
                        return null;
                    } catch (Exception e) {
                        log.warn("NTS {} 1차 예외: {}", year, e.getMessage());
                        return null;
                    }
                }));
            }

            List<NtsYearSession> yearSessions   = new ArrayList<>();
            List<CompletableFuture<NtsYearSession>> pendingFutures = new ArrayList<>();
            try {
                CompletableFuture.anyOf(futures.toArray(new CompletableFuture[0])).get(20, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                log.warn("NTS 1차 - 20초 내 응답 없음, 완료된 연도만 수집");
            } catch (Exception ignored) {}

            for (CompletableFuture<NtsYearSession> f : futures) {
                if (!f.isDone()) { pendingFutures.add(f); continue; }
                try { NtsYearSession s = f.join(); if (s != null) yearSessions.add(s); }
                catch (Exception ignored) {}
            }

            if (yearSessions.isEmpty()) {
                log.error("NTS 연말정산 1차 - 모든 연도 실패. userId: {}", userId);
                throw new RuntimeException("연말정산 데이터 조회에 실패했습니다. 잠시 후 다시 시도해주세요.");
            }
            log.info("NTS 1차 완료 - 수집된 연도: {}", yearSessions.stream().map(NtsYearSession::getYear).toList());

            String sessionKey = UUID.randomUUID().toString();
            ntsMultiSessions.put(sessionKey, new NtsMultiSession(userId, yearSessions));
            if (!pendingFutures.isEmpty()) pendingNtsFutures.put(sessionKey, pendingFutures);
            return sessionKey;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NTS 연말정산 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("연말정산 요청 중 오류: " + e.getMessage(), e);
        }
    }

    @Transactional
    public int syncYeartaxStep2(String sessionKey) {
        NtsMultiSession multiSession = ntsMultiSessions.get(sessionKey);
        if (multiSession == null)
            throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");

        Long userId      = multiSession.getUserId();
        int totalUpdated = 0;

        try {
            for (NtsYearSession nts : multiSession.getYearSessions()) {
                try {
                    if ("CF-00000".equals(nts.getCode()) && nts.getRawResult() != null) {
                        log.info("NTS {} - CF-00000 직접 저장", nts.getYear());
                        totalUpdated += updateNonCoveredAmounts(userId, nts.getRawResult());
                    } else {
                        HashMap<String, Object> certMap = new HashMap<>(nts.getParams());
                        certMap.put("twoWayInfo", buildTwoWayInfo(nts.getTwoWayData()));
                        certMap.put("is2Way",    true);
                        certMap.put("simpleAuth","1");

                        log.info("NTS {} 2차 요청", nts.getYear());
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

            List<CompletableFuture<NtsYearSession>> pending = pendingNtsFutures.remove(sessionKey);
            if (pending != null && !pending.isEmpty()) {
                try {
                    CompletableFuture.allOf(pending.toArray(new CompletableFuture[0])).get(30, TimeUnit.SECONDS);
                } catch (TimeoutException e) {
                    log.warn("NTS pending futures 30초 초과 - 일부 연도 누락 가능");
                } catch (Exception ignored) {}
                for (CompletableFuture<NtsYearSession> f : pending) {
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
            log.info("NTS 연말정산 동기화 완료 - userId: {}, updated: {}", userId, totalUpdated);
            return totalUpdated;

        } catch (RuntimeException e) { throw e;
        } catch (Exception e) {
            log.error("NTS 연말정산 2차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("연말정산 인증 중 오류: " + e.getMessage(), e);
        }
    }

    // ── 데이터 파싱 + 저장 ─────────────────────────────────────────────────

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

        List<Map<String, Object>> basicList     = (List<Map<String, Object>>) data.getOrDefault("resBasicTreatList",    List.of());
        List<Map<String, Object>> prescribeList = (List<Map<String, Object>>) data.getOrDefault("resPrescribeDrugList", List.of());

        medicalRecordRepo.deleteByUserId(userId);
        medicationDetailRepo.deleteByUserId(userId);

        List<MedicalRecord> records = new ArrayList<>();
        for (Map<String, Object> item : basicList) {
            String dateStr  = str(item.get("resTreatStartDate"));
            String hospital = str(item.get("resHospitalName"));
            if (dateStr == null || dateStr.isBlank() || hospital == null || hospital.isBlank()) continue;

            records.add(MedicalRecord.builder()
                    .userId(userId)
                    .visitDate(parseDate8(dateStr))
                    .hospital(hospital)
                    .department(strOrDefault(item.get("resDepartment"), "미상"))
                    .diagnosis(strOrDefault(item.get("resDiseaseName"), "기타"))
                    .diseaseCode(str(item.get("resDiseaseCode")))
                    .treatmentDetails(str(item.get("resTreatType")))
                    .medicalCost(parseDouble(item.get("resTotalAmount")))
                    .insuranceCoverage(parseDouble(item.get("resPublicCharge")))
                    .outOfPocket(parseDouble(item.get("resDeductibleAmt")))
                    .build());
        }
        medicalRecordRepo.saveAll(records);

        List<MedicationDetail> medications = new ArrayList<>();
        for (Map<String, Object> item : prescribeList) {
            String dateStr  = str(item.get("resTreatStartDate"));
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
        List<Map<String, Object>> basicList = (List<Map<String, Object>>) data.getOrDefault("resBasicList", List.of());

        Map<String, Double>       ytByDateHospital = new HashMap<>();
        Map<String, List<Double>> ytByDate         = new HashMap<>();

        for (Map<String, Object> basic : basicList) {
            if ("1".equals(str(basic.get("resType")))) continue; // 보험급여 항목 제외
            String companyNm = str(basic.get("resCompanyNm"));
            List<Map<String, Object>> detailList = (List<Map<String, Object>>) basic.getOrDefault("resDetailList", List.of());
            for (Map<String, Object> detail : detailList) {
                String dateStr = str(detail.get("resDatePayment"));
                Double amt     = parseDouble(detail.get("resAmount"));
                if (dateStr == null || dateStr.length() < 8 || amt == null || amt <= 0) continue;
                String date8 = dateStr.substring(0, 8);
                ytByDateHospital.merge(date8 + "::" + normalizeHospital(companyNm), amt, Double::sum);
                ytByDate.computeIfAbsent(date8, k -> new ArrayList<>()).add(amt);
            }
        }

        List<MedicalRecord> records = medicalRecordRepo.findByUserIdOrderByVisitDateDesc(userId);
        int updated = 0;
        for (MedicalRecord rec : records) {
            if (rec.getVisitDate() == null || rec.getOutOfPocket() == null) continue;
            String date8 = rec.getVisitDate().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

            Double ytAmount = ytByDateHospital.get(date8 + "::" + normalizeHospital(rec.getHospital()));
            if (ytAmount == null) {
                List<Double> dayAmounts = ytByDate.get(date8);
                if (dayAmounts != null && dayAmounts.size() == 1) ytAmount = dayAmounts.get(0);
            }
            if (ytAmount != null) {
                rec.setNonCoveredAmount(Math.max(0.0, ytAmount - rec.getOutOfPocket()));
                updated++;
            }
        }
        medicalRecordRepo.saveAll(records);
        return updated;
    }

    // ── 유틸리티 ─────────────────────────────────────────────────────────

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

    private SingleSession getValidSingleSession(String sessionKey) {
        SingleSession s = singleSessions.get(sessionKey);
        if (s == null) throw new RuntimeException("세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        if (s.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            singleSessions.remove(sessionKey);
            throw new RuntimeException("인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return s;
    }

    /**
     * NTS 파라미터 생성.
     * loginType="5"(회원 간편인증) + loginTypeLevel 방식이 실제로 동작함.
     * inquiryTypeCD: 의료비만 조회 → "000100000000000"
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
        params.put("inquiryTypeCD",   "000100000000000");
        if ("5".equals(loginTypeLevel)) params.put("telecom", telecom);
        return params;
    }

    /** NTS 시작연도(2023) ~ 전년도 배열 반환 (당해연도 간소화 자료 미제공) */
    private String[] buildNtsYears() {
        int currentYear = LocalDate.now().getYear() - 1;
        List<String> years = new ArrayList<>();
        for (int y = currentYear; y >= NTS_START_YEAR; y--) years.add(String.valueOf(y));
        return years.toArray(new String[0]);
    }

    private String normalizeHospital(String name) {
        if (name == null) return "";
        return name.replaceAll("\\s+", "").toLowerCase();
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
        return s != null ? s : def;
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

    // ── DTO ──────────────────────────────────────────────────────────────

    @Data
    @AllArgsConstructor
    private static class SingleSession {
        private Long userId;
        private HashMap<String, Object> params;
        private Map<String, Object> twoWayData;
        private LocalDateTime createdAt;
    }

    @Data
    @AllArgsConstructor
    private static class NtsMultiSession {
        private Long userId;
        private List<NtsYearSession> yearSessions;
    }

    @Data
    @AllArgsConstructor
    static class NtsYearSession {
        private String year;
        private HashMap<String, Object> params;
        private Map<String, Object> twoWayData;
        private String code;
        /** CF-00000 응답 시 raw JSON 보관 → step2에서 직접 저장. CF-03002이면 null */
        private String rawResult;
    }
}
