package com.medicatch.user.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Password confirmation is required")
    private String passwordConfirm;

    // CODEF 내보험다보여 회원가입 필드
    @NotBlank(message = "주민등록번호를 입력해주세요")
    @Size(min = 13, max = 13, message = "주민등록번호는 13자리여야 합니다")
    private String identity; // 주민등록번호 13자리 (암호화 없이 전송, 생년월일·성별 파생)

    @NotBlank(message = "통신사를 선택해주세요")
    private String telecom; // "0":SKT "1":KT "2":LG U+ "3":알뜰폰(SKT) "4":알뜰폰(KT) "5":알뜰폰(LG U+)

    @NotBlank(message = "전화번호를 입력해주세요")
    private String phoneNo;

    private String authMethod = "0"; // "0":SMS "1":PASS 앱

    @NotBlank(message = "로그인 아이디를 입력해주세요")
    private String id; // CODEF 로그인 아이디, DB에 그대로 저장
}
