package com.medicatch.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 이메일 변경 1차 요청 (SMS/PASS 인증 트리거).
 * 사용자 식별은 JWT(X-User-Id)로 하고, CODEF 본인인증에 필요한 값만 받는다.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangeEmailRequest {

    @NotBlank(message = "주민등록번호를 입력해주세요.")
    private String identity;   // 주민등록번호 13자리

    @NotBlank(message = "통신사를 선택해주세요.")
    private String telecom;    // 0:SKT,1:KT,2:LGU+,3~5:알뜰폰

    @NotBlank(message = "휴대폰번호를 입력해주세요.")
    private String phoneNo;

    private String authMethod; // "0"=SMS, "1"=PASS (default "0")

    @NotBlank(message = "변경할 이메일을 입력해주세요.")
    private String email;      // 변경할 이메일
}
