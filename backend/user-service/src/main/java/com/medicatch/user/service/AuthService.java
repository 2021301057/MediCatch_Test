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

@Slf4j
@Service
@Transactional
public class AuthService {

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
     * 회원가입 1단계: 유효성 검사 → CODEF 1차 요청 (PASS/SMS 인증 트리거)
     */
    public SignupStep1Response signupStep1(SignupRequest request) {
        log.info("회원가입 step1 시작 - email: {}", request.getEmail());

        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new SignupFieldException("password", "비밀번호가 일치하지 않습니다.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

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

        String accessToken = jwtTokenProvider.generateAccessToken(savedUser.getId(), savedUser.getEmail());
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

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
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

        String newAccessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
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
}
