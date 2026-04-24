package com.medicatch.user.service;

import com.medicatch.user.config.JwtTokenProvider;
import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.dto.SignupStep2Request;
import com.medicatch.user.dto.SignupStep3Request;
import com.medicatch.user.entity.User;
import com.medicatch.user.exception.SignupFieldException;
import com.medicatch.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Set;

@Slf4j
@Service
@Transactional
public class AuthService {

    private static final Set<String> ALLOWED_EMAIL_DOMAINS = Set.of(
            "naver.com", "hanmail.net", "daum.net", "nate.com", "korea.kr",
            "kcredit.or.kr", "korea.com", "yahoo.com", "goe.go.kr", "chol.com",
            "sen.go.kr", "gyo6.net", "jnu.ac.kr", "kakao.com"
    );

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final CodefService codefService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider, CodefService codefService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.codefService = codefService;
    }

    /**
     * 회원가입 1단계: 유효성 검사 → 아이디 가용성 확인 → CODEF PASS/SMS 트리거
     */
    public SignupStep1Response signupStep1(SignupRequest request) {
        log.info("회원가입 step1 시작 - email: {}", request.getEmail());

        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new SignupFieldException("passwordConfirm", "비밀번호가 일치하지 않습니다.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        // 이메일 도메인 검증
        validateEmailDomain(request.getEmail());

        // 아이디 형식 검증 (영문 시작, 영문+숫자 6~12자)
        validateCodefId(request.getId());

        // 비밀번호 복잡도 검증
        validatePassword(request.getPassword(), request.getId());

        // 주민등록번호에서 생년월일·성별 파생
        LocalDate birthDate;
        User.Gender gender;
        try {
            String id13 = request.getIdentity();
            int yy = Integer.parseInt(id13.substring(0, 2));
            int mm = Integer.parseInt(id13.substring(2, 4));
            int dd = Integer.parseInt(id13.substring(4, 6));
            char gd = id13.charAt(6);
            int fullYear = (gd == '3' || gd == '4') ? 2000 + yy : 1900 + yy;
            birthDate = LocalDate.of(fullYear, mm, dd);
            gender = (gd == '1' || gd == '3') ? User.Gender.M : User.Gender.F;
        } catch (Exception e) {
            throw new SignupFieldException("identity", "주민등록번호 형식이 올바르지 않습니다.");
        }

        String bcryptHash = passwordEncoder.encode(request.getPassword());

        SignupStep1Response step1Response = codefService.registerStep1WithPassword(
                request.getEmail(),
                request.getName(),
                birthDate,
                gender.name(),
                request.getId(),
                request.getPassword(),
                bcryptHash,
                request.getIdentity(),
                request.getTelecom(),
                request.getPhoneNo(),
                request.getAuthMethod() != null ? request.getAuthMethod() : "0"
        );

        log.info("회원가입 step1 완료 - email: {}", request.getEmail());
        return step1Response;
    }

    /**
     * 회원가입 2단계: CODEF 2차 요청 (PASS/SMS 인증 확인)
     */
    public void signupStep2(SignupStep2Request request) {
        log.info("회원가입 step2 시작 - sessionKey: {}", request.getSessionKey());
        codefService.registerStep2(request.getSessionKey(), request.getSmsAuthNo());
        log.info("회원가입 step2 완료 - sessionKey: {}", request.getSessionKey());
    }

    /**
     * 회원가입 3단계: CODEF 3차 요청 (이메일 인증) → DB 저장 → JWT 발급
     */
    public AuthResponse signupStep3(SignupStep3Request request) {
        log.info("회원가입 step3 시작 - sessionKey: {}", request.getSessionKey());

        CodefService.SignupSessionData sessionData =
                codefService.registerStep3(request.getSessionKey(), request.getEmailAuthNo());

        User.Gender gender = User.Gender.valueOf(sessionData.getGender());

        User user = User.builder()
                .email(sessionData.getEmail())
                .passwordHash(sessionData.getBcryptHash())
                .name(sessionData.getName())
                .birthDate(sessionData.getBirthDate())
                .gender(gender)
                .codefId(sessionData.getCodefId())
                .build();

        User savedUser = userRepository.save(user);
        log.info("회원가입 완료 - userId: {}, codefId: {}", savedUser.getId(), savedUser.getCodefId());

        String accessToken  = jwtTokenProvider.generateAccessToken(savedUser.getId(), savedUser.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(savedUser.getId());

        return AuthResponse.of(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getName(),
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * 로그인
     */
    public AuthResponse login(LoginRequest request) {
        log.info("로그인 시작 - email: {}", request.getEmail());

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    log.warn("로그인 실패: 사용자 없음 - email: {}", request.getEmail());
                    return new IllegalArgumentException("Invalid email or password");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("로그인 실패: 비밀번호 불일치 - email: {}", request.getEmail());
            throw new IllegalArgumentException("Invalid email or password");
        }

        log.info("로그인 성공 - userId: {}", user.getId());

        String accessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * 토큰 갱신
     */
    public AuthResponse refreshToken(String refreshToken) {
        log.info("토큰 갱신 시작");

        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }
        String tokenType = jwtTokenProvider.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            throw new IllegalArgumentException("Token is not a refresh token");
        }
        Long userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        if (userId == null) {
            throw new IllegalArgumentException("Invalid refresh token");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String newAccessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                newAccessToken,
                newRefreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * 사용자 조회
     */
    @Transactional(readOnly = true)
    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    // ── 유효성 검증 ───────────────────────────────────────────────────

    private void validateEmailDomain(String email) {
        String[] parts = email.split("@");
        if (parts.length != 2 || !ALLOWED_EMAIL_DOMAINS.contains(parts[1].toLowerCase())) {
            throw new SignupFieldException("email",
                    "사용 가능한 이메일 도메인이 아닙니다. (naver.com, daum.net, kakao.com 등)");
        }
    }

    private void validateCodefId(String id) {
        if (!id.matches("^[a-zA-Z][a-zA-Z0-9]{5,11}$")) {
            throw new SignupFieldException("id",
                    "아이디는 영문으로 시작하는 영문+숫자 6~12자여야 합니다. 특수문자는 사용할 수 없습니다.");
        }
    }

    private void validatePassword(String password, String codefId) {
        if (password.length() < 9 || password.length() > 20) {
            throw new SignupFieldException("password", "비밀번호는 9자 이상 20자 이하여야 합니다.");
        }
        if (!password.matches(".*[a-zA-Z].*")) {
            throw new SignupFieldException("password", "비밀번호에 영문자가 포함되어야 합니다.");
        }
        if (!password.matches(".*[0-9].*")) {
            throw new SignupFieldException("password", "비밀번호에 숫자가 포함되어야 합니다.");
        }
        if (!password.matches(".*[!@#$%^&*?_~\\[\\]+='|(){}:;\"<>,/\\\\-].*")) {
            throw new SignupFieldException("password",
                    "비밀번호에 특수문자(!@#$%^&*?_~ 등)가 포함되어야 합니다.");
        }
        // 동일 문자 3자 이상 연속 금지
        for (int i = 0; i < password.length() - 2; i++) {
            if (password.charAt(i) == password.charAt(i + 1)
                    && password.charAt(i) == password.charAt(i + 2)) {
                throw new SignupFieldException("password",
                        "동일한 문자/숫자를 3자 이상 연속으로 사용할 수 없습니다.");
            }
        }
        // 연속 문자/숫자 3자 이상 금지 (오름차순/내림차순)
        for (int i = 0; i < password.length() - 2; i++) {
            int d1 = password.charAt(i + 1) - password.charAt(i);
            int d2 = password.charAt(i + 2) - password.charAt(i + 1);
            if ((d1 == 1 && d2 == 1) || (d1 == -1 && d2 == -1)) {
                throw new SignupFieldException("password",
                        "연속되는 문자 또는 숫자를 3자 이상 사용할 수 없습니다.");
            }
        }
        // 아이디와 동일한 비밀번호 금지
        if (codefId != null && !codefId.isBlank()
                && password.toLowerCase().contains(codefId.toLowerCase())) {
            throw new SignupFieldException("password", "비밀번호에 아이디를 포함할 수 없습니다.");
        }
    }
}
