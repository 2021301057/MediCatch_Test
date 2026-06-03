package com.medicatch.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ForgotPwdStep1Request {

    @NotBlank(message = "아이디를 입력해주세요.")
    private String codefId;

    @NotBlank(message = "주민등록번호를 입력해주세요.")
    private String identity;

    @NotBlank(message = "통신사를 선택해주세요.")
    private String telecom;

    @NotBlank(message = "휴대폰번호를 입력해주세요.")
    private String phoneNo;

    private String authMethod; // "0"=SMS, "1"=PASS (default "0")
}
