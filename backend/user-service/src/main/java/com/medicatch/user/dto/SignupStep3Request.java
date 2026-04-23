package com.medicatch.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupStep3Request {

    @NotBlank(message = "Session key is required")
    private String sessionKey;

    @NotBlank(message = "이메일 인증번호를 입력해주세요")
    private String emailAuthNo;
}
