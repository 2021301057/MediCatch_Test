package com.medicatch.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupStep2Request {

    @NotBlank(message = "Session key is required")
    private String sessionKey;

    private String smsAuthNo; // SMS 인증번호 (authMethod="0"일 때 필수)
}
