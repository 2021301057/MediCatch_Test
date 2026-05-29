package com.medicatch.user.controller;

import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.ChangeEmailRequest;
import com.medicatch.user.dto.ChangePwdRequest;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.dto.SignupStep2Request;
import com.medicatch.user.dto.SignupStep3Request;
import com.medicatch.user.dto.SignupStep4Request;
import com.medicatch.user.dto.UserProfileResponse;
import com.medicatch.user.entity.User;
import com.medicatch.user.exception.SignupFieldException;
import com.medicatch.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * 회원가입 1단계: CODEF 1차 요청 (PASS/SMS 인증 트리거)
     */
    @PostMapping("/signup/step1")
    public ResponseEntity<SignupStep1Response> signupStep1(@Valid @RequestBody SignupRequest request) {
        log.info("POST /api/auth/signup/step1 - email: {}", request.getEmail());
        SignupStep1Response response = authService.signupStep1(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 회원가입 2단계: CODEF 2차 요청 (PASS/SMS 인증 확인)
     */
    @PostMapping("/signup/step2")
    public ResponseEntity<Map<String, String>> signupStep2(@Valid @RequestBody SignupStep2Request request) {
        log.info("POST /api/auth/signup/step2 - sessionKey: {}", request.getSessionKey());
        authService.signupStep2(request);
        return ResponseEntity.ok(Map.of("message", "이메일로 발송된 인증번호를 입력해주세요."));
    }

    /**
     * 회원가입 3단계: CODEF 이메일 인증 트리거 (이메일 발송)
     */
    @PostMapping("/signup/step3")
    public ResponseEntity<Map<String, String>> signupStep3(@Valid @RequestBody SignupStep3Request request) {
        log.info("POST /api/auth/signup/step3 - sessionKey: {}", request.getSessionKey());
        authService.signupStep3(request);
        return ResponseEntity.ok(Map.of("message", "이메일로 인증번호가 발송되었습니다. 이메일을 확인해주세요."));
    }

    /**
     * 회원가입 4단계: 이메일 인증 확인 → 계정 생성 및 JWT 발급
     */
    @PostMapping("/signup/step4")
    public ResponseEntity<AuthResponse> signupStep4(@Valid @RequestBody SignupStep4Request request) {
        log.info("POST /api/auth/signup/step4 - sessionKey: {}", request.getSessionKey());
        AuthResponse response = authService.signupStep4(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 로그인
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("POST /api/auth/login - codefId: {}", request.getCodefId());
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Login failed: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * 토큰 갱신
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> request) {
        log.info("POST /api/auth/refresh");
        String refreshToken = request.get("refreshToken");
        if (refreshToken == null || refreshToken.isEmpty()) {
            throw new IllegalArgumentException("Refresh token is required");
        }
        AuthResponse response = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(response);
    }

    /**
     * 프로필 조회
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getProfile() {
        log.info("GET /api/auth/profile");
        String userIdString = (String) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        Long userId = Long.parseLong(userIdString);

        User user = authService.getUserById(userId);
        UserProfileResponse response = UserProfileResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .codefId(user.getCodefId())
                .phoneNo(user.getPhoneNo())
                .birthDate(user.getBirthDate())
                .gender(user.getGender().name())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * 헬스체크
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "user-service"));
    }

    // ── 이메일 변경 (CODEF 2-way 인증) ───────────────────────────────────

    /** 이메일 변경 1단계: CODEF SMS/PASS 인증 트리거 */
    @PostMapping("/change-email/step1")
    public ResponseEntity<SignupStep1Response> changeEmailStep1(@Valid @RequestBody ChangeEmailRequest request) {
        Long userId = currentUserId();
        log.info("POST /api/auth/change-email/step1 - userId: {}", userId);
        return ResponseEntity.ok(authService.changeEmailStep1(userId, request));
    }

    /** 이메일 변경 2단계: 인증번호 확인 → CODEF + 로컬 DB 갱신 */
    @PostMapping("/change-email/step2")
    public ResponseEntity<Map<String, String>> changeEmailStep2(@Valid @RequestBody SignupStep2Request request) {
        Long userId = currentUserId();
        log.info("POST /api/auth/change-email/step2 - userId: {}", userId);
        authService.changeEmailStep2(userId, request);
        return ResponseEntity.ok(Map.of("message", "이메일이 변경되었습니다."));
    }

    // ── 비밀번호 변경 (CODEF 2-way 인증) ─────────────────────────────────

    /** 비밀번호 변경 1단계: CODEF SMS/PASS 인증 트리거 */
    @PostMapping("/change-pwd/step1")
    public ResponseEntity<SignupStep1Response> changePwdStep1(@Valid @RequestBody ChangePwdRequest request) {
        Long userId = currentUserId();
        log.info("POST /api/auth/change-pwd/step1 - userId: {}", userId);
        return ResponseEntity.ok(authService.changePwdStep1(userId, request));
    }

    /** 비밀번호 변경 2단계: SMS/PASS 인증 확인 → step3(이메일 임시비번) 필요 여부 반환 */
    @PostMapping("/change-pwd/step2")
    public ResponseEntity<Map<String, Object>> changePwdStep2(@Valid @RequestBody SignupStep2Request request) {
        Long userId = currentUserId();
        log.info("POST /api/auth/change-pwd/step2 - userId: {}", userId);
        boolean needsStep3 = authService.changePwdStep2(userId, request);
        if (needsStep3) {
            return ResponseEntity.ok(Map.of(
                    "needsStep3", true,
                    "message", "이메일로 임시비밀번호를 발송했습니다. 확인 후 입력해주세요.",
                    "sessionKey", request.getSessionKey()
            ));
        }
        return ResponseEntity.ok(Map.of("needsStep3", false, "message", "비밀번호가 변경되었습니다."));
    }

    /** 비밀번호 변경 3단계: 이메일 임시비번 확인 → CODEF 최종 완료 + DB 갱신 */
    @PostMapping("/change-pwd/step3")
    public ResponseEntity<Map<String, String>> changePwdStep3(@RequestBody Map<String, String> request) {
        Long userId = currentUserId();
        log.info("POST /api/auth/change-pwd/step3 - userId: {}", userId);
        String sessionKey = request.get("sessionKey");
        String tempPassword = request.get("tempPassword");
        if (sessionKey == null || sessionKey.isBlank() || tempPassword == null || tempPassword.isBlank()) {
            throw new IllegalArgumentException("sessionKey와 tempPassword가 필요합니다.");
        }
        authService.changePwdStep3(userId, sessionKey, tempPassword);
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다."));
    }

    /** SecurityContext(게이트웨이 X-User-Id 주입)에서 현재 사용자 ID 추출 */
    private Long currentUserId() {
        String userIdString = (String) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        return Long.parseLong(userIdString);
    }

    // ── 예외 핸들러 ──────────────────────────────────────────────────

    @ExceptionHandler(SignupFieldException.class)
    public ResponseEntity<Map<String, Object>> handleSignupFieldException(SignupFieldException e) {
        log.warn("회원가입 필드 오류: {}", e.getFieldErrors());
        Map<String, Object> body = new HashMap<>();
        body.put("message", e.getMessage());
        body.put("fieldErrors", e.getFieldErrors());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        log.warn("유효성 검사 실패: {}", fieldErrors);
        Map<String, Object> body = new HashMap<>();
        body.put("message", "입력 정보를 확인해주세요.");
        body.put("fieldErrors", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("잘못된 요청: {}", e.getMessage());
        Map<String, Object> body = new HashMap<>();
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
