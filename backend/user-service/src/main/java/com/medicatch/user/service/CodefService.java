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

    private static final String REGISTER_URL     = "/v1/kr/insurance/0001/credit4u/register";
    private static final String STATUS_URL       = "/v1/kr/insurance/0001/credit4u/registration-status";
    private static final String CHANGE_EMAIL_URL = "/v1/kr/insurance/0001/credit4u/change-email";
    private static final String CHANGE_PWD_URL   = "/v1/kr/insurance/0001/credit4u/change-pwd";
    private static final int SESSION_TIMEOUT_MINUTES = 10;

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, SignupSessionData> signupSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ChangeSessionData> changeSessions = new ConcurrentHashMap<>();

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

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep1Result(responseMap);

            Map<String, Object> step1Data = toMap(responseMap.get("data"));

            String sessionKey = UUID.randomUUID().toString();
            signupSessions.put(sessionKey, new SignupSessionData(
                    email, name, phoneNo, birthDate, gender, codefId, bcryptHash, rsaPassword,
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

    // ── 이메일 변경: 1차(SMS/PASS 트리거) ─────────────────────────────

    public SignupStep1Response changeEmailStep1(
            String userName, String identity, String telecom, String phoneNo,
            String authMethod, String newEmail) {
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> paramMap = new HashMap<>();
            paramMap.put("organization", "0001");
            paramMap.put("userName", userName);
            paramMap.put("identity", identity);
            paramMap.put("email", newEmail);
            paramMap.put("telecom", telecom);
            paramMap.put("phoneNo", phoneNo);
            paramMap.put("authMethod", authMethod);

            log.info("CODEF 이메일 변경 1차 요청 (SMS/PASS 트리거) - userName: {}", userName);
            String result = codef.requestProduct(CHANGE_EMAIL_URL, serviceType(), paramMap);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep1Result(responseMap);

            Map<String, Object> step1Data = toMap(responseMap.get("data"));
            String sessionKey = UUID.randomUUID().toString();
            changeSessions.put(sessionKey, new ChangeSessionData(
                    "email", authMethod, paramMap, step1Data, null, newEmail, null, null, LocalDateTime.now()));

            log.info("CODEF 이메일 변경 1차 완료 - sessionKey: {}", sessionKey);
            return SignupStep1Response.builder()
                    .sessionKey(sessionKey)
                    .requiresTwoWay(true)
                    .authMethod(authMethod)
                    .build();

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 이메일 변경 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("이메일 변경 요청 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    // ── 이메일 변경: 2차(SMS/PASS 확인) → 변경할 이메일 반환 ─────────────

    public String changeEmailStep2(String sessionKey, String smsAuthNo) {
        ChangeSessionData session = getValidChangeSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", buildTwoWayInfo(session.getStep1ResponseData()));
            reqCertMap.put("is2Way", true);
            reqCertMap.put("simpleAuth", "1");
            if (smsAuthNo != null && !smsAuthNo.isBlank()) {
                reqCertMap.put("smsAuthNo", smsAuthNo);
            }

            log.info("CODEF 이메일 변경 2차 요청 (인증 확인) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(CHANGE_EMAIL_URL, serviceType(), reqCertMap);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkChangeFinalResult(responseMap, false);

            changeSessions.remove(sessionKey);
            log.info("CODEF 이메일 변경 완료 - sessionKey: {}", sessionKey);
            return session.getNewEmail();

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 이메일 변경 2차 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("smsAuthNo", "인증에 실패했습니다. 다시 시도해주세요.");
        }
    }

    // ── 비밀번호 변경: 1차(SMS/PASS 트리거) ───────────────────────────

    public SignupStep1Response changePwdStep1(
            Long userId, String userName, String identity, String telecom, String phoneNo,
            String authMethod, String codefId, String rawPassword, String bcryptHash, String email) {
        try {
            if (publicKey == null || publicKey.isBlank()) {
                throw new SignupFieldException("general", "CODEF 공개키가 설정되지 않았습니다. 관리자에게 문의하세요.");
            }
            String rsaPassword = EasyCodefUtil.encryptRSA(rawPassword, publicKey);

            EasyCodef codef = createCodef();

            HashMap<String, Object> paramMap = new HashMap<>();
            paramMap.put("organization", "0001");
            paramMap.put("userName", userName);
            paramMap.put("identity", identity);
            paramMap.put("id", codefId);
            paramMap.put("password", rsaPassword);
            paramMap.put("type", "0");
            paramMap.put("telecom", telecom);
            paramMap.put("phoneNo", phoneNo);
            paramMap.put("authMethod", authMethod);
            paramMap.put("sendMethod", "1"); // 임시비번 휴대폰 수신
            if (email != null && !email.isBlank()) {
                paramMap.put("email", email);
            }

            log.info("CODEF 비밀번호 변경 1차 요청 (SMS/PASS 트리거) - codefId: {}", codefId);
            String result = codef.requestProduct(CHANGE_PWD_URL, serviceType(), paramMap);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            checkStep1Result(responseMap);

            Map<String, Object> step1Data = toMap(responseMap.get("data"));
            String sessionKey = UUID.randomUUID().toString();
            ChangeSessionData sessionData = new ChangeSessionData(
                    "password", authMethod, paramMap, step1Data, null, null, bcryptHash, null, LocalDateTime.now());
            sessionData.setUserId(userId);
            changeSessions.put(sessionKey, sessionData);

            log.info("CODEF 비밀번호 변경 1차 완료 - sessionKey: {}", sessionKey);
            return SignupStep1Response.builder()
                    .sessionKey(sessionKey)
                    .requiresTwoWay(true)
                    .authMethod(authMethod)
                    .build();

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 비밀번호 변경 1차 실패: {}", e.getMessage(), e);
            throw new RuntimeException("비밀번호 변경 요청 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    // ── 비밀번호 변경: 2차(SMS/PASS 확인) → step3(이메일 임시비번) 필요 여부 반환 ───────────
    // type="0" 기준: SMS 확인 후 항상 CF-03002 + extraInfo.reqUserPass1 로 이메일 임시비번 발송됨.
    // step3에서 임시비번 입력 → CF-00000 + resRegistrationStatus="1" 이 진짜 완료.

    @SuppressWarnings("unchecked")
    public boolean changePwdStep2(String sessionKey, String smsAuthNo) {
        ChangeSessionData session = getValidChangeSession(sessionKey);
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", buildTwoWayInfo(session.getStep1ResponseData()));
            reqCertMap.put("is2Way", true);
            reqCertMap.put("simpleAuth", "1");
            if (smsAuthNo != null && !smsAuthNo.isBlank()) {
                reqCertMap.put("smsAuthNo", smsAuthNo);
            }

            log.info("CODEF 비밀번호 변경 2차 요청 (SMS/PASS 확인) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(CHANGE_PWD_URL, serviceType(), reqCertMap);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = (Map<String, Object>) responseMap.get("result");
            String code = (String) resultField.get("code");
            Map<String, Object> data = toMap(responseMap.get("data"));

            log.info("CODEF 비밀번호 변경 2차 응답 - code: {}, sessionKey: {}", code, sessionKey);

            if ("CF-03002".equals(code)) {
                Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
                log.info("CODEF 비밀번호 변경 2차 CF-03002 - extraInfo: {}", extraInfo);

                // extraInfo에 명시적 에러 코드가 있으면 실패
                String extraCode = (String) extraInfo.get("code");
                String extraMsg  = (String) extraInfo.get("message");
                if (extraCode != null && !extraCode.isBlank()) {
                    throw new SignupFieldException(resolveErrorField(extraMsg),
                            extraMsg != null && !extraMsg.isBlank() ? extraMsg : "인증에 실패했습니다.");
                }

                // 에러 없는 CF-03002 → 이메일 임시비번 발송 단계 → step3 필요
                session.setStep2ResponseData(data);
                log.info("CODEF 비밀번호 변경 2차 완료 - step3 필요 - sessionKey: {}", sessionKey);
                return true;
            }

            if ("CF-00000".equals(code)) {
                String status = (String) data.get("resRegistrationStatus");
                String resultDesc = (String) data.get("resResultDesc");
                log.info("CODEF 비밀번호 변경 2차 CF-00000 - resRegistrationStatus: {}, resResultDesc: {}, data keys: {}",
                        status, resultDesc, data.keySet());
                if ("1".equals(status)) {
                    changeSessions.remove(sessionKey);
                    log.info("CODEF 비밀번호 변경 2차에서 직접 완료 - sessionKey: {}", sessionKey);
                    return false;
                }
                if ("2".equals(status)) {
                    session.setStep2ResponseData(data);
                    log.info("CODEF 비밀번호 변경 2차 완료 - 이메일 임시비번 발송됨(status=2), step3 필요 - sessionKey: {}", sessionKey);
                    return true;
                }
                if ("0".equals(status)) {
                    // status="0" = 변경 실패. resResultDesc에 사유가 담김.
                    log.warn("CODEF 비밀번호 변경 2차 실패(status=0) - desc: {}, sessionKey: {}", resultDesc, sessionKey);
                    changeSessions.remove(sessionKey);
                    throw new SignupFieldException("general",
                            resultDesc != null && !resultDesc.isBlank()
                                    ? resultDesc
                                    : "비밀번호 변경에 실패했습니다. 입력 정보를 확인해주세요.");
                }
                // status가 null이거나 다른 값 → step3 필요로 처리 (DEMO 환경 대응)
                log.warn("CODEF 비밀번호 변경 2차 CF-00000 - 예상치 못한 status: {}, step3로 진행", status);
                session.setStep2ResponseData(data);
                return true;
            }

            String msg = buildErrorMessage(resultField);
            log.warn("CODEF 비밀번호 변경 2차 비정상 응답 - code: {}, msg: {}", code, msg);
            throw new SignupFieldException("smsAuthNo", msg.isBlank() ? "인증에 실패했습니다. 다시 시도해주세요." : msg);

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 비밀번호 변경 2차 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("smsAuthNo", "인증에 실패했습니다. 다시 시도해주세요.");
        }
    }

    // ── 비밀번호 변경: 3차(이메일 임시비번 입력) → 최종 완료 → bcrypt 해시 반환 ──────

    @SuppressWarnings("unchecked")
    public String changePwdStep3(String sessionKey, String tempPassword) {
        ChangeSessionData session = getValidChangeSession(sessionKey);
        if (session.getStep2ResponseData() == null) {
            throw new SignupFieldException("general", "인증 순서가 올바르지 않습니다. 처음부터 다시 시도해주세요.");
        }
        try {
            EasyCodef codef = createCodef();

            HashMap<String, Object> reqCertMap = new HashMap<>(session.getOriginalParams());
            reqCertMap.put("twoWayInfo", buildTwoWayInfo(session.getStep2ResponseData()));
            reqCertMap.put("is2Way", true);
            String rsaTempPassword = EasyCodefUtil.encryptRSA(tempPassword, publicKey);
            reqCertMap.put("password1", rsaTempPassword);

            log.info("CODEF 비밀번호 변경 3차 요청 (이메일 임시비번 확인) - sessionKey: {}", sessionKey);
            String result = codef.requestCertification(CHANGE_PWD_URL, serviceType(), reqCertMap);

            Map<String, Object> responseMap = objectMapper.readValue(result, Map.class);
            Map<String, Object> resultField = (Map<String, Object>) responseMap.get("result");
            String code = (String) resultField.get("code");
            Map<String, Object> data = toMap(responseMap.get("data"));

            log.info("CODEF 비밀번호 변경 3차 응답 - code: {}, sessionKey: {}", code, sessionKey);

            if ("CF-00000".equals(code)) {
                String status = (String) data.get("resRegistrationStatus");
                if ("1".equals(status)) {
                    String bcryptHash = session.getBcryptHash();
                    changeSessions.remove(sessionKey);
                    log.info("CODEF 비밀번호 변경 완료 - sessionKey: {}", sessionKey);
                    return bcryptHash;
                }
                String desc = (String) data.get("resResultDesc");
                throw new SignupFieldException("tempPassword",
                        desc != null && !desc.isBlank() ? desc : "비밀번호 변경에 실패했습니다.");
            }

            if ("CF-03002".equals(code)) {
                Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
                String extraCode = (String) extraInfo.get("code");
                String extraMsg  = (String) extraInfo.get("message");
                if (extraCode != null && !extraCode.isBlank()) {
                    throw new SignupFieldException(resolveErrorField(extraMsg),
                            extraMsg != null && !extraMsg.isBlank() ? extraMsg : "임시비밀번호 인증에 실패했습니다.");
                }
            }

            String msg = buildErrorMessage(resultField);
            throw new SignupFieldException("tempPassword", msg.isBlank() ? "임시비밀번호가 올바르지 않습니다." : msg);

        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 비밀번호 변경 3차 실패: {}", e.getMessage(), e);
            throw new SignupFieldException("tempPassword", "임시비밀번호 인증 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
    }

    public Long getChangeSessionUserId(String sessionKey) {
        return getValidChangeSession(sessionKey).getUserId();
    }

    private ChangeSessionData getValidChangeSession(String sessionKey) {
        ChangeSessionData session = changeSessions.get(sessionKey);
        if (session == null) {
            throw new SignupFieldException("general", "인증 세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        }
        if (session.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            changeSessions.remove(sessionKey);
            throw new SignupFieldException("general", "인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }
        return session;
    }

    // 이메일 변경 2차 결과 검증 (비밀번호 변경은 changePwdStep2/3에서 직접 처리).
    // CF-00000 + resRegistrationStatus="1" 만 성공. CF-03002는 이메일 변경에서도 에러.
    @SuppressWarnings("unchecked")
    private void checkChangeFinalResult(Map<String, Object> responseMap, boolean isPwd) {
        Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
        if (result == null) throw new RuntimeException("CODEF 응답 형식 오류");
        String code = (String) result.get("code");

        Map<String, Object> data = toMap(responseMap.get("data"));
        Map<String, Object> extraInfo = toMap(data.get("extraInfo"));
        String extraCode = (String) extraInfo.get("code");
        String extraMsg  = (String) extraInfo.get("message");
        if (extraCode != null && !extraCode.isBlank()) {
            throw new SignupFieldException(resolveErrorField(extraMsg),
                    extraMsg != null && !extraMsg.isBlank() ? extraMsg : "처리에 실패했습니다.");
        }

        // CF-03002는 아직 진행 중이므로 성공으로 보지 않음
        if (!"CF-00000".equals(code)) {
            log.warn("변경 API 최종 비정상 코드 - code: {}, message: {}", code, result.get("message"));
            String msg = buildErrorMessage(result);
            throw new SignupFieldException(resolveErrorField(msg),
                    msg.isBlank() ? (isPwd ? "비밀번호 변경에 실패했습니다." : "이메일 변경에 실패했습니다.") : msg);
        }

        String status = (String) data.get("resRegistrationStatus");
        if (!"1".equals(status)) {
            String desc = (String) data.get("resResultDesc");
            String msg = (desc != null && !desc.isBlank()) ? desc
                    : (isPwd ? "비밀번호 변경에 실패했습니다." : "이메일 변경에 실패했습니다.");
            throw new SignupFieldException(resolveErrorField(msg), msg);
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

            Map<String, Object> map1 = objectMapper.readValue(result1, Map.class);
            Map<String, Object> res1 = (Map<String, Object>) map1.get("result");
            String code1 = (String) res1.get("code");

            // CF-12832: 미가입 아이디(사용 가능), CF-12861: 미등록 아이디(비번 불일치 or 미가입) → 둘 다 가입 진행
            // 실제 중복 여부는 이후 REGISTER_URL 요청에서 CODEF가 최종 판단
            if ("CF-12832".equals(code1) || "CF-12861".equals(code1)) {
                log.info("CODEF 아이디 신규 등록 가능 판단 - codefId: {}, code: {}", codefId, code1);
                return;
            }
            if (!"CF-03002".equals(code1)) {
                log.warn("CODEF 아이디 확인 실패 - code: {}, message: {}", code1, res1.get("message"));
                throw new SignupFieldException("id", "이미 등록된 아이디이거나 사용할 수 없는 아이디입니다.");
            }

            // 2차 요청
            Map<String, Object> data1 = toMap(map1.get("data"));
            HashMap<String, Object> reqCertMap = new HashMap<>(paramMap);
            reqCertMap.put("twoWayInfo", buildTwoWayInfo(data1));
            reqCertMap.put("is2Way", true);

            log.info("CODEF 아이디 가용성 확인 2차 - codefId: {}", codefId);
            String result2 = codef.requestCertification(STATUS_URL, serviceType(), reqCertMap);

            Map<String, Object> map2 = objectMapper.readValue(result2, Map.class);
            Map<String, Object> res2 = (Map<String, Object>) map2.get("result");
            String code2 = (String) res2.get("code");

            if (!"CF-12832".equals(code2) && !"CF-12861".equals(code2)) {
                log.warn("CODEF 아이디 확인 실패 - code: {}, message: {}", code2, res2.get("message"));
                throw new SignupFieldException("id", "이미 등록된 아이디이거나 사용할 수 없는 아이디입니다.");
            }
            log.info("CODEF 아이디 신규 등록 가능 판단 - codefId: {}, code: {}", codefId, code2);

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
        private String phoneNo;
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

    // ── 계정 변경(이메일/비밀번호) 세션 데이터 ──────────────────────────

    @Data
    @AllArgsConstructor
    public static class ChangeSessionData {
        private String type;            // "email" | "password"
        private String authMethod;      // "0"=SMS, "1"=PASS
        private HashMap<String, Object> originalParams;
        private Map<String, Object> step1ResponseData;  // 2차 twoWayInfo 구성용
        private Map<String, Object> step2ResponseData;  // 3차 twoWayInfo 구성용 (비번 변경 임시비번 단계)
        private String newEmail;        // type="email"일 때 변경할 이메일
        private String bcryptHash;      // type="password"일 때 DB 저장용 bcrypt 해시
        private Long userId;            // forgot-pwd 흐름에서 JWT 없이 DB 갱신 시 사용
        private LocalDateTime createdAt;
    }
}
