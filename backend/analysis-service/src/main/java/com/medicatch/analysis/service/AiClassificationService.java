package com.medicatch.analysis.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.medicatch.analysis.dto.AiClassificationResult;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class AiClassificationService {

    @Value("${ai.api-key:}")
    private String apiKey;

    @Value("${ai.model:gpt-4o-mini}")
    private String model;

    @Value("${ai.base-url:https://api.openai.com/v1}")
    private String baseUrl;

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String SYSTEM_PROMPT = """
            당신은 한국 실손보험 진료 분류 전문가입니다.
            사용자가 입력한 의료 검색어를 보험 내부 코드로 분류하는 역할만 합니다.
            보장 여부, 보험금 금액, 치료 권고는 절대 언급하지 마세요.

            반드시 아래 JSON만 반환하세요. 마크다운, 설명, 추가 텍스트 금지:
            {
              "normalizedQuery": "표준 의학 용어로 표현한 검색어",
              "injuryDiseaseType": "INJURY 또는 DISEASE 또는 UNKNOWN",
              "careType": "OUTPATIENT 또는 INPATIENT 또는 SURGERY 또는 TEST 또는 MEDICATION 또는 DIAGNOSIS 또는 UNKNOWN",
              "benefitType": "COVERED 또는 NON_COVERED 또는 MIXED 또는 UNKNOWN",
              "treatmentCategory": "GENERAL 또는 DENTAL 또는 KOREAN_MEDICINE 또는 REHAB 또는 IMAGING 또는 INJECTION 또는 SURGERY 또는 CANCER",
              "actualLossCategory": "GENERAL_OUTPATIENT 또는 GENERAL_INPATIENT 또는 GENERAL_SURGERY 또는 NON_COVERED_THREE 또는 DENTAL_INJURY 또는 DENTAL_DISEASE 또는 KOREAN_MEDICINE_COVERED 또는 KOREAN_MEDICINE 또는 KOREAN_MEDICINE_HERBAL 또는 MEDICATION 또는 null",
              "fixedBenefitCategory": "CANCER 또는 FRACTURE_DIAGNOSIS 또는 SURGERY_BENEFIT 또는 HOSPITALIZATION_DAILY 또는 null",
              "confidence": "HIGH 또는 MEDIUM 또는 LOW",
              "needsUserConfirmation": true 또는 false,
              "reason": "분류 근거 한 문장 최대 80자",
              "nextQuestions": []
            }

            분류 기준:
            - injuryDiseaseType: 사고·외상·골절이면 INJURY / 내과 질환·만성병이면 DISEASE / 판단 불가이면 UNKNOWN
            - careType: 일반 외래이면 OUTPATIENT / 수술이면 SURGERY / MRI·CT·내시경이면 TEST / 약제이면 MEDICATION / 입원이면 INPATIENT
            - treatmentCategory: 도수치료·체외충격파이면 REHAB / MRI·CT·초음파이면 IMAGING / 주사치료이면 INJECTION / 그 외는 GENERAL
            - actualLossCategory 선택 기준:
                일반 외래 → GENERAL_OUTPATIENT
                일반 입원 → GENERAL_INPATIENT
                일반 수술 → GENERAL_SURGERY
                도수·체외충격파·비급여주사·비급여MRI → NON_COVERED_THREE
                치과 외상 → DENTAL_INJURY / 치과 질병 → DENTAL_DISEASE
                한방 급여 → KOREAN_MEDICINE_COVERED / 한방 비급여 → KOREAN_MEDICINE / 한약 → KOREAN_MEDICINE_HERBAL
                약제 처방 → MEDICATION
                진단 담보 전용(치료 아님) → null
            - fixedBenefitCategory 선택 기준:
                골절·파열 진단이면 FRACTURE_DIAGNOSIS
                수술 수반이면 SURGERY_BENEFIT
                암 관련이면 CANCER
                입원 필요이면 HOSPITALIZATION_DAILY
                해당 없으면 null
            - needsUserConfirmation: 추가 정보 없이 분류가 불확실하면 true
            - nextQuestions: needsUserConfirmation=true이면 2~3개, false이면 빈 배열 []
            """;

    public AiClassificationService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    public AiClassificationResult classify(String query) {
        if (apiKey == null || apiKey.isBlank()) {
            log.debug("OpenAI API key not configured, using heuristic classification for query='{}'", query);
            return heuristicClassify(query);
        }
        try {
            String content = callOpenAi(query);
            return parseClassification(content, query);
        } catch (Exception e) {
            log.warn("AI classification failed for query='{}': {}, falling back to heuristic", query, e.getMessage());
            return heuristicClassify(query);
        }
    }

    /**
     * OpenAI 호출 불가(미설정, 429, 네트워크 오류 등) 시 키워드 기반 분류.
     * confidence=LOW, needsUserConfirmation=true 로 반환해 사용자에게 확인 요청.
     */
    private AiClassificationResult heuristicClassify(String query) {
        String n = query.toLowerCase().replaceAll("\\s+", "");

        // 진료 형태
        boolean isSurgery   = containsAny(n, "수술", "절제", "봉합", "절개");
        boolean isTest      = containsAny(n, "mri", "ct", "초음파", "내시경", "엑스레이", "xray", "혈액검사", "조직검사");
        boolean isRehab     = containsAny(n, "도수치료", "도수", "체외충격파", "충격파", "재활치료");
        boolean isInjection = containsAny(n, "주사치료", "프롤로", "인대주사", "신경주사");
        boolean isDental    = containsAny(n, "치아", "치과", "치수", "잇몸", "치주", "신경치료", "임플란트", "치아파절", "치아균열");
        boolean isKorean    = containsAny(n, "한방", "한의원", "침치료", "뜸", "추나", "첩약");
        boolean isHerbal    = containsAny(n, "한약", "탕약", "첩약");

        // 상해/질병 구분
        boolean isInjury   = containsAny(n, "골절", "파열", "인대파열", "근육파열", "타박", "삐끗", "염좌",
                "찢", "상처", "찰과상", "화상", "탈구", "탈골", "외상", "사고", "충돌", "넘어");
        boolean isDisease  = containsAny(n, "위염", "당뇨", "고혈압", "갑상선", "비염", "축농증", "역류",
                "피부염", "두드러기", "요로결석", "편두통", "빈혈", "천식", "폐렴", "간염", "신장",
                "자궁", "난소", "전립선", "통풍", "류마티스");

        String injuryDiseaseType = isInjury ? "INJURY" : isDisease ? "DISEASE" : "UNKNOWN";
        String careType = isSurgery ? "SURGERY"
                : isTest ? "TEST"
                : "OUTPATIENT";
        String treatmentCategory = isTest ? "IMAGING"
                : isRehab || isInjection ? "REHAB"
                : isDental ? "DENTAL"
                : isKorean || isHerbal ? "KOREAN_MEDICINE"
                : isSurgery ? "SURGERY"
                : "GENERAL";
        String actualLossCategory = isHerbal ? "KOREAN_MEDICINE_HERBAL"
                : isKorean ? "KOREAN_MEDICINE"
                : isDental ? (isInjury ? "DENTAL_INJURY" : "DENTAL_DISEASE")
                : isRehab || isInjection ? "NON_COVERED_THREE"
                : isSurgery ? "GENERAL_SURGERY"
                : "GENERAL_OUTPATIENT";

        return AiClassificationResult.builder()
                .normalizedQuery(query)
                .injuryDiseaseType(injuryDiseaseType)
                .careType(careType)
                .benefitType("UNKNOWN")
                .treatmentCategory(treatmentCategory)
                .actualLossCategory(actualLossCategory)
                .fixedBenefitCategory(null)
                .confidence("LOW")
                .needsUserConfirmation(true)
                .reason("키워드 기반 추정 결과입니다. AI 분류를 사용할 수 없어 정확도가 낮을 수 있습니다.")
                .nextQuestions(List.of(
                        "상해(사고) 치료인가요, 질병 치료인가요?",
                        "급여 항목인가요, 비급여 항목인가요?"))
                .source("HEURISTIC")
                .build();
    }

    private boolean containsAny(String target, String... keywords) {
        for (String kw : keywords) {
            if (target.contains(kw)) return true;
        }
        return false;
    }

    private String callOpenAi(String query) throws Exception {
        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", "검색어: " + query)
        );

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", 0);
        body.put("max_tokens", 400);

        String jsonBody = objectMapper.writeValueAsString(body);

        Request request = new Request.Builder()
                .url(baseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(jsonBody, MediaType.get("application/json; charset=utf-8")))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String err = response.body() != null ? response.body().string() : "(no body)";
                throw new RuntimeException("OpenAI API error " + response.code() + ": " + err);
            }
            String raw = response.body().string();
            JsonNode root = objectMapper.readTree(raw);
            return root.path("choices").get(0).path("message").path("content").asText();
        }
    }

    private AiClassificationResult parseClassification(String content, String originalQuery) {
        try {
            String json = content.trim();
            // 마크다운 코드블록 제거
            if (json.startsWith("```")) {
                json = json.replaceAll("(?s)^```[a-z]*\\n?", "").replaceAll("```\\s*$", "").trim();
            }

            JsonNode node = objectMapper.readTree(json);

            List<String> nextQuestions = new ArrayList<>();
            JsonNode nqNode = node.path("nextQuestions");
            if (nqNode.isArray()) {
                nqNode.forEach(q -> nextQuestions.add(q.asText()));
            }

            return AiClassificationResult.builder()
                    .normalizedQuery(textOrDefault(node, "normalizedQuery", originalQuery))
                    .injuryDiseaseType(textOrDefault(node, "injuryDiseaseType", "UNKNOWN"))
                    .careType(textOrDefault(node, "careType", "OUTPATIENT"))
                    .benefitType(textOrDefault(node, "benefitType", "UNKNOWN"))
                    .treatmentCategory(textOrDefault(node, "treatmentCategory", "GENERAL"))
                    .actualLossCategory(nullableText(node, "actualLossCategory"))
                    .fixedBenefitCategory(nullableText(node, "fixedBenefitCategory"))
                    .confidence(textOrDefault(node, "confidence", "LOW"))
                    .needsUserConfirmation(node.path("needsUserConfirmation").asBoolean(true))
                    .reason(textOrDefault(node, "reason", "AI 분류 결과입니다."))
                    .nextQuestions(nextQuestions)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse AI classification JSON for query='{}': {}", originalQuery, e.getMessage());
            return null;
        }
    }

    private String textOrDefault(JsonNode node, String field, String defaultValue) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return defaultValue;
        String v = n.asText().trim();
        return (v.isEmpty() || "null".equalsIgnoreCase(v)) ? defaultValue : v;
    }

    private String nullableText(JsonNode node, String field) {
        JsonNode n = node.path(field);
        if (n.isMissingNode() || n.isNull()) return null;
        String v = n.asText().trim();
        return (v.isEmpty() || "null".equalsIgnoreCase(v)) ? null : v;
    }
}
