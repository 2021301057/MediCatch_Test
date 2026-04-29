package com.medicatch.health.dto;

import com.medicatch.health.entity.CheckupResult;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class CheckupResultDto {

    private Long id;
    private int year;
    private LocalDate checkupDate;
    private Double height;
    private Double weight;
    private Double bmi;
    private String bloodPressure;
    private Double bloodSugar;
    private Double cholesterol;
    private Double hdlCholesterol;
    private Double ldlCholesterol;
    private Double triglycerides;
    private String judgement;
    private String opinion;
    private List<ResultItem> results;

    @Data
    @Builder
    public static class ResultItem {
        private String category;
        private String value;
        private String status;
        private String normal;
    }

    public static CheckupResultDto from(CheckupResult e) {
        Double bmi = calcBmi(e.getHeight(), e.getWeight());
        String bp = formatBp(e.getBloodPressureSystolic(), e.getBloodPressureDiastolic());

        return CheckupResultDto.builder()
                .id(e.getId())
                .year(e.getCheckupDate() != null ? e.getCheckupDate().getYear() : 0)
                .checkupDate(e.getCheckupDate())
                .height(e.getHeight())
                .weight(e.getWeight())
                .bmi(bmi)
                .bloodPressure(bp)
                .bloodSugar(e.getGlucose())
                .cholesterol(e.getTotalCholesterol())
                .hdlCholesterol(e.getHdlCholesterol())
                .ldlCholesterol(e.getLdlCholesterol())
                .triglycerides(e.getTriglycerides())
                .judgement(e.getRecommendations())
                .opinion(e.getAbnormalFindings())
                .results(buildResults(e, bmi, bp))
                .build();
    }

    private static Double calcBmi(Double height, Double weight) {
        if (height == null || weight == null || height == 0) return null;
        double h = height / 100.0;
        return Math.round((weight / (h * h)) * 10.0) / 10.0;
    }

    private static String formatBp(Double systolic, Double diastolic) {
        if (systolic == null && diastolic == null) return null;
        String s = systolic != null ? String.valueOf(systolic.intValue()) : "?";
        String d = diastolic != null ? String.valueOf(diastolic.intValue()) : "?";
        return s + "/" + d;
    }

    private static List<ResultItem> buildResults(CheckupResult e, Double bmi, String bp) {
        List<ResultItem> list = new ArrayList<>();

        if (bp != null) {
            Double sys = e.getBloodPressureSystolic();
            String status = sys == null ? "NORMAL" : sys >= 140 ? "DANGER" : sys >= 130 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("혈압").value(bp + " mmHg").status(status).normal("130/85 미만").build());
        }
        if (e.getGlucose() != null) {
            Double g = e.getGlucose();
            String status = g >= 126 ? "DANGER" : g >= 100 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("혈당").value(g.intValue() + " mg/dL").status(status).normal("100 미만").build());
        }
        if (e.getTotalCholesterol() != null) {
            Double c = e.getTotalCholesterol();
            String status = c >= 240 ? "DANGER" : c >= 200 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("총콜레스테롤").value(c.intValue() + " mg/dL").status(status).normal("200 미만").build());
        }
        if (bmi != null) {
            String status = bmi >= 30 ? "DANGER" : bmi >= 25 ? "WARNING" : bmi < 18.5 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("BMI").value(String.valueOf(bmi)).status(status).normal("18.5~24.9").build());
        }
        if (e.getHdlCholesterol() != null) {
            Double h = e.getHdlCholesterol();
            String status = h < 40 ? "DANGER" : h < 60 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("HDL 콜레스테롤").value(h.intValue() + " mg/dL").status(status).normal("60 이상").build());
        }
        if (e.getLdlCholesterol() != null) {
            Double l = e.getLdlCholesterol();
            String status = l >= 160 ? "DANGER" : l >= 130 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("LDL 콜레스테롤").value(l.intValue() + " mg/dL").status(status).normal("130 미만").build());
        }
        if (e.getTriglycerides() != null) {
            Double t = e.getTriglycerides();
            String status = t >= 500 ? "DANGER" : t >= 150 ? "WARNING" : "NORMAL";
            list.add(ResultItem.builder().category("중성지방").value(t.intValue() + " mg/dL").status(status).normal("150 미만").build());
        }

        return list;
    }
}
