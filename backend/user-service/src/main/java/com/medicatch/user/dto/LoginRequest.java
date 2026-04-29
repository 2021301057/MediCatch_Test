package com.medicatch.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    /**
     * 사이트 로그인 아이디 (= CODEF 내보험다보여 아이디 = User.codefId).
     * 프론트엔드 LoginPage 가 { loginId, password } 로 보내며,
     * 백엔드는 이 값을 User.codefId 컬럼과 매칭해 로그인 처리한다.
     */
    @NotBlank(message = "아이디를 입력해주세요.")
    private String loginId;

    @NotBlank(message = "비밀번호를 입력해주세요.")
    private String password;
}
