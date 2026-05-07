package com.medicatch.analysis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.time.LocalDate;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClaimPaymentInfo {

    private Long id;
    private LocalDate occurrenceDate;
    private LocalDate paymentDate;
    private String companyName;
    private String reasonForPayment;
    private String judgeResult;
    private Double paidAmount;
}
