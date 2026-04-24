package com.medicatch.user.controller;

import com.medicatch.user.dto.AuthResponse;
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
        log.info("POST /api/auth/login - email: {}", request.getEmail());
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
        int codefConnectionCount = (int) user.getCodefConnections().stream()
                .filter(conn -> conn.isActive()).count();

        UserProfileResponse response = UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .birthDate(user.getBirthDate())
                .gender(user.getGender().name())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .codefConnectionCount(codefConnectionCount)
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
