package com.medicatch.user.exception;

import lombok.Getter;

import java.util.Map;

@Getter
public class SignupFieldException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public SignupFieldException(String field, String message) {
        super(message);
        this.fieldErrors = Map.of(field, message);
    }

    public SignupFieldException(Map<String, String> fieldErrors) {
        super("회원가입 입력값 오류");
        this.fieldErrors = fieldErrors;
    }
}
