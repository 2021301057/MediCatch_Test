package com.medicatch.user.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.exception.SignupFieldException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.binary.Base64;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import javax.crypto.Cipher;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class CodefService {

    @Value("${codef.client-id:YOUR_CODEF_CLIENT_ID}")
    private String codefClientId;

    @Value("${codef.client-secret:YOUR_CODEF_CLIENT_SECRET}")
    private String codefClientSecret;

    @Value("${codef.token-url:https://api.codef.io/oauth/token}")
    private String codefTokenUrl;

    @Value("${codef.rsa-public-key:}")
    private String codefRsaPublicKey;

    @Value("${codef.credit4u-register-url:https://api.codef.io/v1/kr/etc/credit4u/member/sign-up}")
    private String credit4uRegisterUrl;

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    // 회원가입 세션 임시 저장소 (step1 → step2 연결)
    private final ConcurrentHashMap<String, SignupSessionData> signupSessions = new ConcurrentHashMap<>();

    private static final int SESSION_TIMEOUT_MINUTES = 10;

    public CodefService(WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.webClient = webClientBuilder.build();
        this.objectMapper = objectMapper;
        Security.addProvider(new BouncyCastleProvider());
    }

    // ── 내보험다보여 회원가입 Step1 ──────────────────────────────────

    public SignupStep1Response registerStep1WithPassword(
            String email, String name, LocalDate birthDate, String gender,
            String codefId, String rawPassword, String bcryptHash,
            String identity, String telecom, String phoneNo, String authMethod) {

        String rsaPassword = encryptRSA(rawPassword);
        String checkParamUUID = generateCheckParamUUID();

        String accessToken = getAccessToken();

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("type", "1");
        requestBody.put("checkParamUUID", checkParamUUID);
        requestBody.put("userName", name);
        requestBody.put("identity", identity);
        requestBody.put("telecom", telecom);
        requestBody.put("phoneNo", phoneNo);
        requestBody.put("authMethod", authMethod);
        requestBody.put("id", codefId);
        requestBody.put("password", rsaPassword);
        requestBody.put("reqUserId", codefId);
        requestBody.put("reqUserPass", rsaPassword);
        requestBody.put("reqEmail", email);

        log.info("CODEF 내보험다보여 회원가입 step1 요청 - codefId: {}", codefId);

        String response = webClient.post()
                .uri(credit4uRegisterUrl)
                .header("Authorization", "Bearer " + accessToken)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.debug("CODEF step1 응답: {}", response);

        // 응답 파싱
        checkCodefResponseCode(response);
        Map<String, Object> twoWayInfo = parseTwoWayInfo(response);
        boolean requiresTwoWay = twoWayInfo != null;

        // 세션 저장
        String sessionKey = generateSessionKey();
        SignupSessionData sessionData = new SignupSessionData(
                email, name, birthDate, gender,
                codefId, bcryptHash, rsaPassword,
                identity, telecom, phoneNo, authMethod,
                checkParamUUID, twoWayInfo, requiresTwoWay,
                LocalDateTime.now()
        );
        signupSessions.put(sessionKey, sessionData);

        log.info("CODEF step1 완료 - sessionKey: {}, requiresTwoWay: {}", sessionKey, requiresTwoWay);

        return SignupStep1Response.builder()
                .sessionKey(sessionKey)
                .requiresTwoWay(requiresTwoWay)
                .authMethod(authMethod)
                .build();
    }

    // ── 내보험다보여 회원가입 Step2 ──────────────────────────────────

    public SignupSessionData registerStep2(String sessionKey, String smsAuthNo) {
        SignupSessionData sessionData = signupSessions.get(sessionKey);
        if (sessionData == null) {
            throw new SignupFieldException("smsAuthNo", "인증 세션이 없거나 만료되었습니다. 처음부터 다시 시도해주세요.");
        }
        if (sessionData.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(SESSION_TIMEOUT_MINUTES))) {
            signupSessions.remove(sessionKey);
            throw new SignupFieldException("smsAuthNo", "인증 시간이 초과되었습니다. 처음부터 다시 시도해주세요.");
        }

        if (!sessionData.isRequiresTwoWay()) {
            // CODEF이 step1에서 이미 성공 → step2 CODEF 호출 불필요
            signupSessions.remove(sessionKey);
            return sessionData;
        }

        String accessToken = getAccessToken();

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("type", "1");
        requestBody.put("checkParamUUID", sessionData.getCheckParamUUID());
        requestBody.put("userName", sessionData.getName());
        requestBody.put("identity", sessionData.getIdentity());
        requestBody.put("telecom", sessionData.getTelecom());
        requestBody.put("phoneNo", sessionData.getPhoneNo());
        requestBody.put("authMethod", sessionData.getAuthMethod());
        requestBody.put("id", sessionData.getCodefId());
        requestBody.put("password", sessionData.getRsaPassword());
        requestBody.put("reqUserId", sessionData.getCodefId());
        requestBody.put("reqUserPass", sessionData.getRsaPassword());
        requestBody.put("reqEmail", sessionData.getEmail());
        requestBody.put("is2Way", true);
        requestBody.put("twoWayInfo", sessionData.getTwoWayInfo());
        if (smsAuthNo != null && !smsAuthNo.isBlank()) {
            requestBody.put("smsAuthNo", smsAuthNo);
        }

        log.info("CODEF 내보험다보여 회원가입 step2 요청 - codefId: {}", sessionData.getCodefId());

        String response = webClient.post()
                .uri(credit4uRegisterUrl)
                .header("Authorization", "Bearer " + accessToken)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        log.debug("CODEF step2 응답: {}", response);

        checkCodefResponseCode(response);

        signupSessions.remove(sessionKey);
        log.info("CODEF 내보험다보여 회원가입 완료 - codefId: {}", sessionData.getCodefId());

        return sessionData;
    }

    // ── 기존 메서드 ──────────────────────────────────────────────────

    public String getAccessToken() {
        try {
            log.info("Requesting CODEF access token");

            Map<String, String> request = new HashMap<>();
            request.put("client_id", codefClientId);
            request.put("client_secret", codefClientSecret);
            request.put("grant_type", "client_credentials");

            String response = webClient.post()
                    .uri(codefTokenUrl)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF token response received");
            return extractAccessTokenFromResponse(response);
        } catch (Exception e) {
            log.error("Failed to get CODEF access token: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to get CODEF access token", e);
        }
    }

    public String createConnectedId(String organization, String loginType, String id, String password) {
        try {
            log.info("Creating CODEF connected ID for organization: {}", organization);

            String accessToken = getAccessToken();

            Map<String, Object> request = new HashMap<>();
            request.put("connectedId", id);
            request.put("connectedPassword", encryptRSA(password));
            request.put("loginType", loginType);
            request.put("organization", organization);

            String response = webClient.post()
                    .uri("https://api.codef.io/v1/connected/login")
                    .header("Authorization", "Bearer " + accessToken)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.debug("CODEF connected ID created");
            return extractConnectedIdFromResponse(response);
        } catch (Exception e) {
            log.error("Failed to create CODEF connected ID: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create CODEF connected ID", e);
        }
    }

    public String encryptRSA(String plaintext) {
        try {
            if (codefRsaPublicKey == null || codefRsaPublicKey.isEmpty()) {
                log.warn("CODEF RSA public key not configured, returning plaintext");
                return plaintext;
            }

            byte[] decodedKey = Base64.decodeBase64(codefRsaPublicKey);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(decodedKey);
            KeyFactory kf = KeyFactory.getInstance("RSA", "BC");
            PublicKey publicKey = kf.generatePublic(spec);

            Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding", "BC");
            cipher.init(Cipher.ENCRYPT_MODE, publicKey);

            byte[] encryptedBytes = cipher.doFinal(plaintext.getBytes());
            return Base64.encodeBase64String(encryptedBytes);
        } catch (Exception e) {
            log.error("Failed to encrypt with RSA: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to encrypt data with RSA", e);
        }
    }

    // ── 내부 헬퍼 메서드 ─────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseTwoWayInfo(String response) {
        try {
            Map<String, Object> responseMap = objectMapper.readValue(response, Map.class);
            Map<String, Object> data = (Map<String, Object>) responseMap.get("data");
            if (data != null && data.containsKey("twoWayInfo")) {
                return (Map<String, Object>) data.get("twoWayInfo");
            }
            return null;
        } catch (Exception e) {
            log.error("twoWayInfo 파싱 실패: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private void checkCodefResponseCode(String response) {
        try {
            Map<String, Object> responseMap = objectMapper.readValue(response, Map.class);
            Map<String, Object> result = (Map<String, Object>) responseMap.get("result");
            if (result == null) {
                throw new RuntimeException("CODEF API 응답 형식 오류");
            }
            String code = (String) result.get("code");
            if (!"CF-00000".equals(code)) {
                String extraMessage = (String) result.getOrDefault("extraMessage", "");
                String message = (String) result.getOrDefault("message", "CODEF 오류");
                String errorMsg = (extraMessage != null && !extraMessage.isBlank()) ? extraMessage : message;
                log.warn("CODEF 오류 응답 code={}, message={}", code, errorMsg);
                throw new SignupFieldException(resolveErrorField(errorMsg), errorMsg);
            }
        } catch (SignupFieldException e) {
            throw e;
        } catch (Exception e) {
            log.error("CODEF 응답 파싱 실패: {}", e.getMessage());
            throw new RuntimeException("CODEF API 응답 처리 중 오류가 발생했습니다.");
        }
    }

    private String resolveErrorField(String message) {
        if (message == null) return "general";
        String m = message.toLowerCase();
        if (m.contains("주민") || m.contains("identity")) return "identity";
        if (m.contains("전화") || m.contains("phone") || m.contains("휴대")) return "phoneNo";
        if (m.contains("통신") || m.contains("telecom")) return "telecom";
        if (m.contains("아이디") || m.contains("id")) return "id";
        if (m.contains("비밀번호") || m.contains("password")) return "password";
        if (m.contains("인증번호") || m.contains("sms")) return "smsAuthNo";
        if (m.contains("이메일") || m.contains("email")) return "email";
        return "general";
    }

    private String generateCheckParamUUID() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String generateSessionKey() {
        return java.util.UUID.randomUUID().toString();
    }

    private String extractAccessTokenFromResponse(String response) {
        try {
            if (response != null && response.contains("access_token")) {
                int startIndex = response.indexOf("\"access_token\":\"") + 16;
                int endIndex = response.indexOf("\"", startIndex);
                return response.substring(startIndex, endIndex);
            }
            return "";
        } catch (Exception e) {
            log.error("Failed to parse access token from response: {}", e.getMessage());
            return "";
        }
    }

    private String extractConnectedIdFromResponse(String response) {
        try {
            if (response != null && response.contains("connectedId")) {
                int startIndex = response.indexOf("\"connectedId\":\"") + 15;
                int endIndex = response.indexOf("\"", startIndex);
                return response.substring(startIndex, endIndex);
            }
            return "";
        } catch (Exception e) {
            log.error("Failed to parse connected ID from response: {}", e.getMessage());
            return "";
        }
    }

    // ── 세션 데이터 ───────────────────────────────────────────────────

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class SignupSessionData {
        private String email;
        private String name;
        private LocalDate birthDate;
        private String gender;
        private String codefId;
        private String bcryptHash;    // DB 저장용 BCrypt 해시
        private String rsaPassword;   // CODEF 전송용 RSA 암호화 값
        private String identity;
        private String telecom;
        private String phoneNo;
        private String authMethod;
        private String checkParamUUID;
        private Map<String, Object> twoWayInfo;
        private boolean requiresTwoWay;
        private LocalDateTime createdAt;
    }
}
