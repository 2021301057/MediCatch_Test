package com.medicatch.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.exception.SignupFieldException;
import io.codef.api.EasyCodef;
import io.codef.api.EasyCodefServiceType;
import io.codef.api.EasyCodefUtil;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
public class CodefService {

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

    private static final String PRODUCT_URL = "/v1/kr/insurance/0001/credit4u/register";
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, SignupSessionData> signupSessions = new ConcurrentHashMap<>();

    public CodefService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ── Step1: 1차 요청 (PASS/SMS 인증 트리거) ────────────────────────

    public SignupStep1Response registerStep1WithPassword(
            String email, String name, LocalDate birthDate, String gender,
            String codefId, String rawPassword, String bcryptHash,
            String identity, String telecom, String phoneNo, String authMethod) {
        try {
            if (publicKey == null || publicKey.isBlank()) {
                throw new SignupFieldException("general", "CODEF 공개키가 설정되지 않았습니다. 관리자에게 문의하세요.");
            }
            String rsaPassword = EasyCodefUtil.encryptRSA(rawPassword, publicKey);
            String checkParamUUID = generateCheckParamUUID();

            EasyCodef codef = createCodef();

            HashMap<String, Object> paramMap = new HashMap<>();
            paramMap.put("organization", "0001");
            paramMap.put("userName", name);
            paramMap.put("identity", identity);
            paramMap.put("telecom", telecom);
            paramMap.put("phoneNo", phoneNo);
            paramMap.put("authMethod", authMethod);
            paramMap.put("type", "1");
            paramMap.put("id", codefId);
            paramMap.put("password", rsaPassword);
            paramMap.put("email", email);
            paramMap.put("checkParamUUID", checkParamUUID);

            log.info("CODEF 내보험다보여 1차 요청 - codefId: {}", codefId);
            String result = codef.requestProduct(PRODUCT_URL, serviceType(), paramMap);
            log.debug("CODEF 1차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep1Result(responseMap);

            Map<String, Object> step1Data = toMap(responseMap.get("data"));

            String sessionKey = UUID.randomUUID().toString();
            signupSessions.put(sessionKey, new SignupSessionData(
                    email, name, birthDate, gender, codefId, bcryptHash, rsaPassword,
                    authMethod, paramMap, null, step1Data, LocalDateTime.now()
            ));

            log.info("CODEF 1차 완료 - sessionKey: {}", sessionKey);
            return SignupStep1Response.builder()
                    .sessionKey(sessionKey)
                    .requiresTwoWay(true)
                    .authMethod(authMethod)
                    .build();

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 1차 요청 실패: {}", e.getMessage(), e);
            throw new RuntimeException("내보험다보여 가입 요청 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    // ── Step2: 2차 요청 (PASS/SMS 인증 확인) ─────────────────────────

    public void registerStep2(String sessionKey, String smsAuthNo) {
        SignupSessionData session = getValidSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            Map<String, Object> step1Data = session.getStep1ResponseData();

            HashMap<String, Object> twoWayInfo = new HashMap<>();
            twoWayInfo.put("jobIndex", step1Data.get("jobIndex"));
            twoWayInfo.put("threadIndex", step1Data.get("threadIndex"));
            twoWayInfo.put("jti", step1Data.get("jti"));
            twoWayInfo.put("twoWayTimestamp", step1Data.get("twoWayTimestamp"));

            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", twoWayInfo);
            reqCertMap.put("is2Way", true);
            reqCertMap.put("simpleAuth", "1");

            if (smsAuthNo != null && !smsAuthNo.isBlank()) {
                reqCertMap.put("smsAuthNo", smsAuthNo);
            }

            log.info("CODEF 내보험다보여 2차 요청 - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(PRODUCT_URL, serviceType(), reqCertMap);
            log.debug("CODEF 2차 응답: {}", result);

            // step3에서 재사용할 certParams 세션에 저장
            session.setCertParams(reqCertMap);

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 2차 요청 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("smsAuthNo", "인증에 실패했습니다. 다시 시도해주세요.");
        }
    }

    // ── Step2 완료 후 세션 데이터 반환 (이메일 인증 생략) ─────────────────

    public SignupSessionData completeRegistration(String sessionKey) {
        SignupSessionData session = getValidSession(sessionKey);
        signupSessions.remove(sessionKey);
        log.info("CODEF 내보험다보여 가입 완료 (이메일 인증 생략) - codefId: {}", session.getCodefId());
        return session;
    }

    // ── Step3: 3차 요청 (이메일 인증번호 확인 + 최종 가입 완료) ───────────

    public SignupSessionData registerStep3(String sessionKey, String emailAuthNo) {
        SignupSessionData session = getValidSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> reqCertMap = new HashMap<>(session.getCertParams());
            reqCertMap.put("emailAuthNo", emailAuthNo);
            reqCertMap.put("reqUserId", session.getCodefId());
            reqCertMap.put("reqUserPass", session.getRsaPassword());
            reqCertMap.put("reqEmail", session.getEmail());

            log.info("CODEF 내보험다보여 3차 요청 (최종) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(PRODUCT_URL, serviceType(), reqCertMap);
            log.debug("CODEF 3차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkFinalResult(responseMap);

            signupSessions.remove(sessionKey);
            log.info("CODEF 내보험다보여 가입 완료 - codefId: {}", session.getCodefId());
            return session;

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 3차 요청 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("emailAuthNo", "이메일 인증에 실패했습니다. 인증번호를 확인해주세요.");
        }
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────

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

    private SignupSessionData getValidSession(String sessionKey) {
        SignupSessionData session = signupSessions.get(sessionKey);
        if (session == null) {
            throw new SignupFieldException("general", "인증 세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        }
        if (session.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            signupSessions.remove(sessionKey);
            throw new SignupFieldException("general", "인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return session;
    }

    @SuppressWarnings("unchecked")
    private void checkStep1Result(Map<String, Object> responseMap) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");
        // CF-03002: 추가인증 필요 → 정상 (1차 요청 기대값)
        // CF-00000: 즉시 성공 (드문 케이스)
        if (!"CF-00000".equals(code) && !"CF-03002".equals(code)) {
            String msg = buildErrorMessage(result);
            throw new SignupFieldException(resolveErrorField(msg), msg);
        }
    }

    @SuppressWarnings("unchecked")
    private void checkFinalResult(Map<String, Object> responseMap) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");
        if (!"CF-00000".equals(code)) {
            String msg = buildErrorMessage(result);
            throw new SignupFieldException(resolveErrorField(msg), msg);
        }
    }

    private String buildErrorMessage(Map<String, Object> result) {
        String extra = (String) result.getOrDefault("extraMessage", "");
        String msg = (String) result.getOrDefault("message", "CODEF 오류");
        return (extra != null && !extra.isBlank()) ? extra : msg;
    }

    private String resolveErrorField(String message) {
        if (message == null) return "general";
        String m = message.toLowerCase();
        if (m.contains("주민") || m.contains("identity")) return "identity";
        if (m.contains("전화") || m.contains("phone") || m.contains("휴대")) return "phoneNo";
        if (m.contains("통신") || m.contains("telecom")) return "telecom";
        if (m.contains("아이디") || m.contains("userid")) return "id";
        if (m.contains("비밀번호") || m.contains("password")) return "password";
        if (m.contains("인증번호") || m.contains("sms")) return "smsAuthNo";
        if (m.contains("이메일") || m.contains("email")) return "emailAuthNo";
        return "general";
    }

    private String generateCheckParamUUID() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(timestamp);
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object obj) {
        if (obj instanceof Map) return (Map<String, Object>) obj;
        return new HashMap<>();
    }

    // ── 세션 데이터 ───────────────────────────────────────────────────

    @Data
    @AllArgsConstructor
    public static class SignupSessionData {
        private String email;
        private String name;
        private LocalDate birthDate;
        private String gender;
        private String codefId;
        private String bcryptHash;
        private String rsaPassword;
        private String authMethod;
        private HashMap<String, Object> originalParams;    // 1차 요청 파라미터
        private HashMap<String, Object> certParams;        // 2차 요청 파라미터 (3차에서 재사용)
        private Map<String, Object> step1ResponseData;     // 1차 응답 data (twoWayInfo 구성용)
        private LocalDateTime createdAt;
    }
}
