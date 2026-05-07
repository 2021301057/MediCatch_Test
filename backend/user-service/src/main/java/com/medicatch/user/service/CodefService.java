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

    private static final String REGISTER_URL = "/v1/kr/insurance/0001/credit4u/register";
    private static final String STATUS_URL   = "/v1/kr/insurance/0001/credit4u/registration-status";
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, SignupSessionData> signupSessions = new ConcurrentHashMap<>();

    public CodefService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ── Step1: 아이디 가용성 확인 + PASS/SMS 인증 트리거 ─────────────────

    public SignupStep1Response registerStep1WithPassword(
            String email, String name, LocalDate birthDate, String gender,
            String codefId, String rawPassword, String bcryptHash,
            String identity, String telecom, String phoneNo, String authMethod) {
        try {
            if (publicKey == null || publicKey.isBlank()) {
                throw new SignupFieldException("general", "CODEF 공개키가 설정되지 않았습니다. 관리자에게 문의하세요.");
            }
            String rsaPassword = EasyCodefUtil.encryptRSA(rawPassword, publicKey);

            // 아이디 가용성 확인 (registration-status)
            checkIdAvailability(codefId, rsaPassword, email);

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

            log.info("CODEF 내보험다보여 1차 요청 (PASS/SMS 트리거) - codefId: {}", codefId);
            String result = codef.requestProduct(REGISTER_URL, serviceType(), paramMap);
            log.debug("CODEF 1차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep1Result(responseMap);

            Map<String, Object> step1Data = toMap(responseMap.get("data"));

            String sessionKey = UUID.randomUUID().toString();
            signupSessions.put(sessionKey, new SignupSessionData(
                    email, name, birthDate, gender, codefId, bcryptHash, rsaPassword,
                    authMethod, paramMap, step1Data, null, null, LocalDateTime.now()
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

    // ── Step2: PASS/SMS 인증 확인 ─────────────────────────────────────

    public void registerStep2(String sessionKey, String smsAuthNo) {
        SignupSessionData session = getValidSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> twoWayInfo = buildTwoWayInfo(session.getStep1ResponseData());
            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", twoWayInfo);
            reqCertMap.put("is2Way", true);
            reqCertMap.put("simpleAuth", "1");
            if (smsAuthNo != null && !smsAuthNo.isBlank()) {
                reqCertMap.put("smsAuthNo", smsAuthNo);
            }

            log.info("CODEF 내보험다보여 2차 요청 (PASS/SMS 확인) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(REGISTER_URL, serviceType(), reqCertMap);
            log.debug("CODEF 2차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep2Result(responseMap);

            // 3차 요청용 twoWayInfo를 위해 2차 응답 data 저장
            session.setStep2ResponseData(toMap(responseMap.get("data")));

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 2차 요청 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("smsAuthNo", "인증에 실패했습니다. 다시 시도해주세요.");
        }
    }

    // ── Step3: 이메일 인증 트리거 (이메일 발송) ───────────────────────────

    public void registerStep3(String sessionKey) {
        SignupSessionData session = getValidSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> twoWayInfo = buildTwoWayInfo(session.getStep2ResponseData());
            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", twoWayInfo);
            reqCertMap.put("is2Way", true);
            reqCertMap.put("reqUserId", session.getCodefId());
            reqCertMap.put("reqUserPass", session.getRsaPassword());
            reqCertMap.put("reqEmail", session.getEmail());

            log.info("CODEF 내보험다보여 3차 요청 (이메일 발송 트리거) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(REGISTER_URL, serviceType(), reqCertMap);
            log.debug("CODEF 3차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep3Result(responseMap);

            session.setStep3ResponseData(toMap(responseMap.get("data")));
            log.info("CODEF 이메일 인증 발송 완료 - sessionKey: {}", sessionKey);

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 3차 요청 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("general", "이메일 인증 요청 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
    }

    // ── Step4: 이메일 인증번호 확인 → 최종 가입 완료 ─────────────────────

    public SignupSessionData registerStep4(String sessionKey, String emailAuthNo) {
        SignupSessionData session = getValidSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> twoWayInfo = buildTwoWayInfo(session.getStep3ResponseData());
            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", twoWayInfo);
            reqCertMap.put("is2Way", true);
            reqCertMap.put("reqUserId", session.getCodefId());
            reqCertMap.put("reqUserPass", session.getRsaPassword());
            reqCertMap.put("reqEmail", session.getEmail());
            if (emailAuthNo != null && !emailAuthNo.isBlank()) {
                reqCertMap.put("emailAuthNo", emailAuthNo);
            }

            log.info("CODEF 내보험다보여 4차 요청 (이메일 인증 확인) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(REGISTER_URL, serviceType(), reqCertMap);
            log.debug("CODEF 4차 응답: {}", result);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkFinalResult(responseMap);

            signupSessions.remove(sessionKey);
            log.info("CODEF 내보험다보여 가입 완료 - codefId: {}", session.getCodefId());
            return session;

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 4차 요청 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("emailAuthNo", "이메일 인증에 실패했습니다. 인증번호를 확인해주세요.");
        }
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private void checkIdAvailability(String codefId, String rsaPassword, String email) {
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> paramMap = new HashMap<>();
            paramMap.put("organization", "0001");
            paramMap.put("id", codefId);
            paramMap.put("password", rsaPassword);
            paramMap.put("inquiryType", "0");
            paramMap.put("email", email);
            paramMap.put("applicationType", "0");

            log.info("CODEF 아이디 가용성 확인 1차 - codefId: {}", codefId);
            String result1 = codef.requestProduct(STATUS_URL, serviceType(), paramMap);
            log.debug("CODEF 아이디 확인 1차 응답: {}", result1);

            Map<String, Object> map1 = objectMapper.readValue(result1, Map.class);
            Map<String, Object> res1 = (Map<String, Object>) map1.get("result");
            String code1 = (String) res1.get("code");

            if ("CF-12832".equals(code1)) {
                log.info("CODEF 아이디 사용 가능 (1차 즉시 확인) - codefId: {}", codefId);
                return;
            }
            if (!"CF-03002".equals(code1)) {
                throw new SignupFieldException("id", "이미 등록된 아이디이거나 사용할 수 없는 아이디입니다.");
            }

            // 2차 요청
            Map<String, Object> data1 = toMap(map1.get("data"));
            HashMap<String, Object> reqCertMap = new HashMap<>(paramMap);
            reqCertMap.put("twoWayInfo", buildTwoWayInfo(data1));
            reqCertMap.put("is2Way", true);

            log.info("CODEF 아이디 가용성 확인 2차 - codefId: {}", codefId);
            String result2 = codef.requestCertification(STATUS_URL, serviceType(), reqCertMap);
            log.debug("CODEF 아이디 확인 2차 응답: {}", result2);

            Map<String, Object> map2 = objectMapper.readValue(result2, Map.class);
            Map<String, Object> res2 = (Map<String, Object>) map2.get("result");
            String code2 = (String) res2.get("code");

            if (!"CF-12832".equals(code2)) {
                throw new SignupFieldException("id", "이미 등록된 아이디이거나 사용할 수 없는 아이디입니다.");
            }
            log.info("CODEF 아이디 사용 가능 - codefId: {}", codefId);

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 아이디 확인 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("id", "아이디 확인 중 오류가 발생했습니다.");
        }
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
        HashMap<String, Object> twoWayInfo = new HashMap<>();
        twoWayInfo.put("jobIndex",        data.get("jobIndex"));
        twoWayInfo.put("threadIndex",     data.get("threadIndex"));
        twoWayInfo.put("jti",             data.get("jti"));
        twoWayInfo.put("twoWayTimestamp", data.get("twoWayTimestamp"));
        return twoWayInfo;
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
        // CF-00000: 즉시 성공, CF-03002: 2차 인증 필요, CF-12832: 아이디 사용 가능(미가입)
        if (!"CF-00000".equals(code) && !"CF-03002".equals(code) && !"CF-12832".equals(code)) {
            String msg = buildErrorMessage(result);
            throw new SignupFieldException(resolveErrorField(msg), msg);
        }
    }

    @SuppressWarnings("unchecked")
    private void checkStep3Result(Map<String, Object> responseMap) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");

        if ("CF-03002".equals(code) || "CF-00000".equals(code)) {
            // extraInfo에 실제 오류가 담겨 있으면 실패 처리
            Map<String, Object> data = toMap(responseMap.get("data"));
            Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
            String extraCode = (String) extraInfo.get("code");
            String extraMsg  = (String) extraInfo.get("message");
            if (extraCode != null && !extraCode.isBlank()) {
                throw new SignupFieldException(
                        resolveErrorField(extraMsg),
                        extraMsg != null && !extraMsg.isBlank() ? extraMsg : "이메일 인증 요청에 실패했습니다.");
            }
            return;
        }

        String msg = buildErrorMessage(result);
        throw new SignupFieldException(resolveErrorField(msg), msg.isBlank() ? "이메일 인증 요청에 실패했습니다." : msg);
    }

    @SuppressWarnings("unchecked")
    private void checkStep2Result(Map<String, Object> responseMap) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");

        if ("CF-03002".equals(code) || "CF-00000".equals(code)) {
            // CF-03002여도 data.extraInfo에 실제 오류가 담길 수 있음 (예: CF-13349 이미 등록된 아이디)
            Map<String, Object> data = toMap(responseMap.get("data"));
            Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
            String extraCode = (String) extraInfo.get("code");
            String extraMsg  = (String) extraInfo.get("message");
            if (extraCode != null && !extraCode.isBlank()) {
                throw new SignupFieldException(
                        resolveErrorField(extraMsg),
                        extraMsg != null && !extraMsg.isBlank() ? extraMsg : "인증에 실패했습니다.");
            }
            return;
        }

        String msg = buildErrorMessage(result);
        throw new SignupFieldException("smsAuthNo", msg.isBlank() ? "휴대폰 인증에 실패했습니다." : msg);
    }

    @SuppressWarnings("unchecked")
    private void checkFinalResult(Map<String, Object> responseMap) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");

        if ("CF-03002".equals(code)) {
            // extraInfo 에서 실제 오류 확인
            Map<String, Object> data = toMap(responseMap.get("data"));
            Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
            String extraCode = (String) extraInfo.get("code");
            String extraMsg  = (String) extraInfo.get("message");
            if (extraCode != null && !extraCode.isBlank()) {
                throw new SignupFieldException(
                        resolveErrorField(extraMsg),
                        extraMsg != null && !extraMsg.isBlank() ? extraMsg : "가입에 실패했습니다.");
            }
            throw new SignupFieldException("general", "가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
        }

        if (!"CF-00000".equals(code)) {
            String msg = buildErrorMessage(result);
            throw new SignupFieldException(resolveErrorField(msg), msg);
        }
    }

    private String buildErrorMessage(Map<String, Object> result) {
        String msg = (String) result.getOrDefault("message", "");
        return (msg != null && !msg.isBlank()) ? msg : "처리 중 오류가 발생했습니다.";
    }

    private String resolveErrorField(String message) {
        if (message == null) return "general";
        String m = message.toLowerCase();
        if (m.contains("주민") || m.contains("등록번호"))                             return "identity";
        if (m.contains("비밀번호") || m.contains("password"))                         return "password";
        if (m.contains("아이디") || m.contains("userid"))                             return "id";
        if (m.contains("이메일") || m.contains("email"))                              return "emailAuthNo";
        if (m.contains("인증번호") || m.contains("sms"))                              return "smsAuthNo";
        if (m.contains("통신") || m.contains("telecom"))                              return "telecom";
        if (m.contains("전화") || m.contains("phone") || m.contains("휴대"))         return "phoneNo";
        if (m.contains("이름") || m.contains("name"))                                 return "name";
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
        private HashMap<String, Object> originalParams;
        private Map<String, Object> step1ResponseData;  // 2차 twoWayInfo 구성용
        private Map<String, Object> step2ResponseData;  // 3차 twoWayInfo 구성용
        private Map<String, Object> step3ResponseData;  // 4차 twoWayInfo 구성용
        private LocalDateTime createdAt;
    }
}
