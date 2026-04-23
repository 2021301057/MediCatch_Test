package com.medicatch.user.service;

import com.medicatch.user.config.JwtTokenProvider;
import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.dto.SignupStep2Request;
import com.medicatch.user.entity.User;
import com.medicatch.user.exception.SignupFieldException;
import com.medicatch.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
     * 회원가입 1단계: 유효성 검사 후 CODEF 내보험다보여 1차 등록 요청
     */
    public SignupStep1Response signupStep1(SignupRequest request) {
        log.info("회원가입 step1 시작 - email: {}", request.getEmail());

        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new SignupFieldException("password", "비밀번호가 일치하지 않습니다.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        User.Gender gender;
        try {
            gender = User.Gender.valueOf(request.getGender().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new SignupFieldException("gender", "성별 값이 올바르지 않습니다. M 또는 F를 입력해주세요.");
        }

        String bcryptHash = passwordEncoder.encode(request.getPassword());

        SignupStep1Response step1Response = codefService.registerStep1WithPassword(
                request.getEmail(),
                request.getName(),
                request.getBirthDate(),
                gender.name(),
                request.getId(),
                request.getPassword(),
                bcryptHash,
                request.getIdentity(),
                request.getTelecom(),
                request.getPhoneNo(),
                request.getAuthMethod() != null ? request.getAuthMethod() : "0"
        );

        log.info("회원가입 step1 완료 - email: {}, requiresTwoWay: {}", request.getEmail(), step1Response.isRequiresTwoWay());
        return step1Response;
    }

    /**
     * 회원가입 2단계: CODEF 2차 인증 완료 후 DB 저장 및 JWT 발급
     */
    public AuthResponse signupStep2(SignupStep2Request request) {
        log.info("회원가입 step2 시작 - sessionKey: {}", request.getSessionKey());

        CodefService.SignupSessionData sessionData = codefService.registerStep2(
                request.getSessionKey(),
                request.getSmsAuthNo()
        );

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
            log.warn("토큰 갱신 실패: 유효하지 않은 refresh token");
            throw new IllegalArgumentException("Invalid refresh token");
        }

        String tokenType = jwtTokenProvider.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            log.warn("토큰 갱신 실패: refresh token이 아님");
            throw new IllegalArgumentException("Token is not a refresh token");
        }

        Long userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        if (userId == null) {
            log.warn("토큰 갱신 실패: userId 추출 불가");
            throw new IllegalArgumentException("Invalid refresh token");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> {
                    log.warn("토큰 갱신 실패: 사용자 없음 - userId: {}", userId);
                    return new IllegalArgumentException("User not found");
                });

        log.info("토큰 갱신 완료 - userId: {}", userId);

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
