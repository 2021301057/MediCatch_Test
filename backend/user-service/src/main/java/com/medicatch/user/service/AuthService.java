package com.medicatch.user.service;

import com.medicatch.user.config.JwtTokenProvider;
import com.medicatch.user.dto.AuthResponse;
import com.medicatch.user.dto.ChangeEmailRequest;
import com.medicatch.user.dto.ChangePwdRequest;
import com.medicatch.user.dto.ForgotPwdStep1Request;
import com.medicatch.user.dto.ForgotPwdStep4Request;
import com.medicatch.user.dto.LoginRequest;
import com.medicatch.user.dto.SignupRequest;
import com.medicatch.user.dto.SignupStep1Response;
import com.medicatch.user.dto.SignupStep2Request;
import com.medicatch.user.dto.SignupStep3Request;
import com.medicatch.user.dto.SignupStep4Request;
import com.medicatch.user.entity.User;
import com.medicatch.user.exception.SignupFieldException;
import com.medicatch.user.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private final InternalDeleteClient internalDeleteClient;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider, CodefService codefService,
                       InternalDeleteClient internalDeleteClient) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.codefService = codefService;
        this.internalDeleteClient = internalDeleteClient;
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
     * 회원가입 3단계: CODEF 3차 요청 (이메일 발송 트리거)
     */
    public void signupStep3(SignupStep3Request request) {
        log.info("회원가입 step3 시작 - sessionKey: {}", request.getSessionKey());
        codefService.registerStep3(request.getSessionKey());
        log.info("회원가입 step3 완료 (이메일 발송) - sessionKey: {}", request.getSessionKey());
    }

    /**
     * 회원가입 4단계: CODEF 4차 요청 (이메일 인증 확인) → DB 저장 → JWT 발급
     */
    public AuthResponse signupStep4(SignupStep4Request request) {
        log.info("회원가입 step4 시작 - sessionKey: {}", request.getSessionKey());

        CodefService.SignupSessionData sessionData =
                codefService.registerStep4(request.getSessionKey(), request.getEmailAuthNo());

        User.Gender gender = User.Gender.valueOf(sessionData.getGender());

        User user = User.builder()
                .email(sessionData.getEmail())
                .passwordHash(sessionData.getBcryptHash())
                .name(sessionData.getName())
                .phoneNo(sessionData.getPhoneNo())
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
                savedUser.getCodefId(),
                savedUser.getPhoneNo(),
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenExpiry()
        );
    }

    /**
     * 로그인
     */
    public AuthResponse login(LoginRequest request) {
        log.info("로그인 시작 - codefId: {}", request.getCodefId());

        User user = userRepository.findByCodefId(request.getCodefId())
                .orElseThrow(() -> {
                    log.warn("로그인 실패: 사용자 없음 - codefId: {}", request.getCodefId());
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("로그인 실패: 비밀번호 불일치 - codefId: {}", request.getCodefId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        log.info("로그인 성공 - userId: {}", user.getId());

        String accessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getCodefId(),
                user.getPhoneNo(),
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
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }
        String tokenType = jwtTokenProvider.getTokenType(refreshToken);
        if (!"refresh".equals(tokenType)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }
        Long userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다. 다시 로그인해주세요.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다. 다시 로그인해주세요."));

        String newAccessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return AuthResponse.of(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getCodefId(),
                user.getPhoneNo(),
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

    // ── 이메일 변경 (CODEF 내보험다보여 + 로컬 DB 동시 갱신) ─────────────

    /** 이메일 변경 1차: 검증 후 CODEF SMS/PASS 인증 트리거 */
    public SignupStep1Response changeEmailStep1(Long userId, ChangeEmailRequest request) {
        User user = getUserById(userId);

        validateEmailDomain(request.getEmail());
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new SignupFieldException("email", "이미 사용 중인 이메일입니다.");
        }
        if (request.getEmail().equalsIgnoreCase(user.getEmail())) {
            throw new SignupFieldException("email", "현재 이메일과 동일합니다.");
        }

        return codefService.changeEmailStep1(
                user.getName(),
                request.getIdentity(),
                request.getTelecom(),
                request.getPhoneNo(),
                request.getAuthMethod() != null ? request.getAuthMethod() : "0",
                request.getEmail());
    }

    /** 이메일 변경 2차: SMS 인증 확인 → 이메일 인증번호 입력(step3) 필요 여부 반환 */
    public boolean changeEmailStep2(Long userId, SignupStep2Request request) {
        getUserById(userId);  // 사용자 존재 확인
        return codefService.changeEmailStep2(request.getSessionKey(), request.getSmsAuthNo());
    }

    /** 이메일 변경 3차: 새 이메일로 받은 인증번호 확인 → CODEF 완료 + 로컬 DB 갱신 */
    public void changeEmailStep3(Long userId, String sessionKey, String emailAuthNo) {
        User user = getUserById(userId);
        String newEmail = codefService.changeEmailStep3(sessionKey, emailAuthNo);

        // CODEF 성공 후 로컬 DB 갱신 (경쟁 상황 대비 유니크 재확인)
        if (userRepository.existsByEmail(newEmail)) {
            throw new SignupFieldException("email", "이미 사용 중인 이메일입니다.");
        }
        user.setEmail(newEmail);
        userRepository.save(user);
        log.info("이메일 변경 완료 (step3) - userId: {}", userId);
    }

    // ── 비밀번호 변경 (CODEF 내보험다보여 + 로컬 DB 동시 갱신) ───────────

    /** 비밀번호 변경 1차: 검증 후 CODEF SMS/PASS 인증 트리거 */
    public SignupStep1Response changePwdStep1(Long userId, ChangePwdRequest request) {
        User user = getUserById(userId);

        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new SignupFieldException("passwordConfirm", "비밀번호가 일치하지 않습니다.");
        }
        validatePassword(request.getPassword(), user.getCodefId());

        String bcryptHash = passwordEncoder.encode(request.getPassword());

        return codefService.changePwdStep1(
                userId,
                user.getName(),
                request.getIdentity(),
                request.getTelecom(),
                request.getPhoneNo(),
                request.getAuthMethod() != null ? request.getAuthMethod() : "0",
                user.getCodefId(),
                request.getPassword(),
                bcryptHash,
                user.getEmail(),
                false);
    }

    /**
     * 비밀번호 변경 2차: SMS/PASS 인증 확인.
     * type="0" 기준으로 항상 step3(이메일 임시비번)가 필요함 → true 반환.
     * 드물게 step2에서 바로 완료되면(false) DB 갱신 후 false 반환.
     */
    public boolean changePwdStep2(Long userId, SignupStep2Request request) {
        boolean needsStep3 = codefService.changePwdStep2(request.getSessionKey(), request.getSmsAuthNo());
        if (!needsStep3) {
            // step2에서 바로 완료된 케이스 — DB 갱신은 CodefService가 bcryptHash를 돌려줄 수 없으므로
            // 이 경로는 현재 type="0"에서 실질적으로 발생하지 않음. 향후 대비용.
            log.info("비밀번호 변경 step2 직접 완료 - userId: {}", userId);
        }
        return needsStep3;
    }

    /** 비밀번호 변경 3차: 이메일 임시비번 확인 → CODEF 최종 완료 + 로컬 DB 갱신 */
    public void changePwdStep3(Long userId, String sessionKey, String tempPassword) {
        User user = getUserById(userId);
        String bcryptHash = codefService.changePwdStep3(sessionKey, tempPassword);
        user.setPasswordHash(bcryptHash);
        userRepository.save(user);
        log.info("비밀번호 변경 완료 (step3) - userId: {}", userId);
    }

    // ── 비밀번호 찾기 (비인증, type="1" 흐름) ─────────────────────────

    /** 비밀번호 찾기 1차: codefId로 사용자 조회 → CODEF SMS/PASS 인증 트리거 (비밀번호는 step4에서 입력) */
    public SignupStep1Response forgotPwdStep1(ForgotPwdStep1Request request) {
        User user = userRepository.findByCodefId(request.getCodefId())
                .orElseThrow(() -> new SignupFieldException("codefId", "등록되지 않은 아이디입니다."));

        return codefService.changePwdStep1(
                user.getId(),
                user.getName(),
                request.getIdentity(),
                request.getTelecom(),
                request.getPhoneNo(),
                request.getAuthMethod() != null ? request.getAuthMethod() : "0",
                user.getCodefId(),
                null,
                null,
                user.getEmail(),
                true);
    }

    /** 비밀번호 찾기 2차: SMS/PASS 인증 확인 */
    public boolean forgotPwdStep2(SignupStep2Request request) {
        return codefService.changePwdStep2(request.getSessionKey(), request.getSmsAuthNo());
    }

    /** 비밀번호 찾기 3차: 휴대폰 임시비번 확인 → step4(새 비밀번호 입력) 대기 */
    public void forgotPwdStep3(String sessionKey, String tempPassword) {
        codefService.changePwdStep3(sessionKey, tempPassword);
        // forgotPwd=true 흐름에서 changePwdStep3는 null 반환(step4 필요) 또는 예외
    }

    /** 비밀번호 찾기 4차: 새 비밀번호 검증 → CODEF 최종 완료 + DB 갱신 */
    public void forgotPwdStep4(ForgotPwdStep4Request request) {
        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new SignupFieldException("passwordConfirm", "비밀번호가 일치하지 않습니다.");
        }
        Long userId = codefService.getChangeSessionUserId(request.getSessionKey());
        User user = getUserById(userId);
        validatePassword(request.getPassword(), user.getCodefId());

        String bcryptHash = passwordEncoder.encode(request.getPassword());
        codefService.changePwdStep4(request.getSessionKey(), request.getPassword(), bcryptHash);
        user.setPasswordHash(bcryptHash);
        userRepository.save(user);
        log.info("비밀번호 찾기 완료 (step4) - userId: {}", userId);
    }

    // ── 회원 탈퇴 ─────────────────────────────────────────────────────

    public void withdraw(Long userId, String password) {
        User user = getUserById(userId);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비밀번호가 올바르지 않습니다.");
        }

        try {
            codefService.unregisterCodef(user.getCodefId(), password);
        } catch (Exception e) {
            log.warn("CODEF 탈퇴 실패 (DB 삭제는 계속 진행) - userId: {}, error: {}", userId, e.getMessage());
        }

        internalDeleteClient.deleteHealthData(userId);
        internalDeleteClient.deleteInsuranceData(userId);
        internalDeleteClient.deleteAnalysisData(userId);
        internalDeleteClient.deleteChatData(userId);

        userRepository.delete(user);
        log.info("회원 탈퇴 완료 - userId: {}", userId);
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
        // '+', '-' 문자 사용 금지
        if (password.contains("+") || password.contains("-")) {
            throw new SignupFieldException("password", "비밀번호에 '+', '-' 문자는 사용할 수 없습니다.");
        }
        if (!password.matches(".*[!@#$%^&*?_~\\[\\]='|(){}:;\"<>,/\\\\].*")) {
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
