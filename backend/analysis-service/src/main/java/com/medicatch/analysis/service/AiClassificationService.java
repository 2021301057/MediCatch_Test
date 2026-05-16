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
              "isValidMedicalQuery": true 또는 false,
              "normalizedQuery": "표준 의학 용어로 표현한 검색어",
              "injuryDiseaseType": "INJURY 또는 DISEASE 또는 UNKNOWN",
              "careType": "OUTPATIENT 또는 INPATIENT 또는 SURGERY 또는 TEST 또는 MEDICATION 또는 DIAGNOSIS 또는 UNKNOWN",
              "benefitType": "COVERED 또는 NON_COVERED 또는 MIXED 또는 UNKNOWN",
              "treatmentCategory": "GENERAL 또는 DENTAL 또는 KOREAN_MEDICINE 또는 REHAB 또는 IMAGING 또는 INJECTION 또는 SURGERY 또는 CANCER 또는 FRACTURE 또는 BURN 또는 CEREBROVASCULAR 또는 DEATH_DISABILITY",
              "actualLossCategory": "GENERAL_OUTPATIENT 또는 GENERAL_INPATIENT 또는 GENERAL_SURGERY 또는 NON_COVERED_THREE 또는 DENTAL_INJURY 또는 DENTAL_DISEASE 또는 KOREAN_MEDICINE_COVERED 또는 KOREAN_MEDICINE 또는 KOREAN_MEDICINE_HERBAL 또는 MEDICATION 또는 null",
              "fixedBenefitCategory": "CANCER 또는 FRACTURE_DIAGNOSIS 또는 SURGERY_BENEFIT 또는 HOSPITALIZATION_DAILY 또는 BURN_DIAGNOSIS 또는 CEREBROVASCULAR 또는 DEATH_DISABILITY 또는 null",
              "confidence": "HIGH 또는 MEDIUM 또는 LOW",
              "needsUserConfirmation": true 또는 false,
              "reason": "분류 근거 한 문장 최대 80자",
              "nextQuestions": []
            }

            ── isValidMedicalQuery ──
            - false: 입력이 의료·보험과 명백히 무관한 경우 (인사말, 무의미한 텍스트, 욕설, 이모지만 있는 경우 등)
            - true: 의료·보험과 관련 가능성이 있는 모든 경우 (증상·진단명·치료명·검사명 등)
            ※ 애매한 경우 반드시 true로 설정할 것

            ── injuryDiseaseType ──
            - INJURY: 사고·외상·골절·인대파열·근육파열·염좌·타박상·찰과상·화상·탈구 등 외력에 의한 손상
            - DISEASE: 감기·위염·당뇨·고혈압·비염·피부염·암 등 내과·만성 질환
            - UNKNOWN: 도수치료·MRI 등 치료/검사 자체 입력처럼 상해/질병 구분 불가

            ── careType ──
            - SURGERY: 수술(절제·봉합·절개·내시경수술 등)
            - TEST: MRI·CT·초음파·내시경(검사 목적)·혈액검사·조직검사
            - MEDICATION: 약 처방·약제 단독
            - INPATIENT: 입원 치료
            - OUTPATIENT: 위에 해당 없는 일반 외래

            ── treatmentCategory ──
            - REHAB: 도수치료·체외충격파·재활치료
            - IMAGING: MRI·CT·초음파·X-ray
            - INJECTION: 주사치료(프롤로·신경주사·인대주사 등)
            - DENTAL: 치아·잇몸·치과
            - KOREAN_MEDICINE: 한방·침·뜸·추나·한약·첩약
            - SURGERY: 수술
            - CANCER: 암 관련
            - FRACTURE: 골절(뼈 골절)이 확인되거나 강하게 의심되는 경우
            - BURN: 화상 진단·치료
            - CEREBROVASCULAR: 뇌졸중·뇌경색·뇌출혈 등 뇌혈관 질환
            - DEATH_DISABILITY: 사망 또는 후유장해 관련
            - GENERAL: 그 외 일반 진료

            ── benefitType ──
            - COVERED: 건강보험 급여 항목 (일반 외래, 일반 수술, 입원 등)
            - NON_COVERED: 비급여 항목 (도수치료·체외충격파·비급여MRI·비급여주사·미용·임플란트 등)
            - MIXED: 급여+비급여 혼재 가능 (예: MRI는 급여도 있고 비급여도 있음)
            - UNKNOWN: 판단 불가

            ── actualLossCategory ──
            - GENERAL_OUTPATIENT: 일반 외래 (감기·위염·피부과·정형외과 일반 외래 등)
            - GENERAL_INPATIENT: 일반 입원
            - GENERAL_SURGERY: 일반 수술 (급여 수술)
            - NON_COVERED_THREE: 도수치료·체외충격파·비급여주사·비급여MRI (3대 비급여)
            - DENTAL_INJURY: 치과 외상 (사고로 인한 치아 파절·탈구)
            - DENTAL_DISEASE: 치과 질병 (충치·신경치료·임플란트·잇몸질환)
            - KOREAN_MEDICINE_COVERED: 한방 급여 (침·뜸 급여 항목)
            - KOREAN_MEDICINE: 한방 비급여 (추나·비급여 침)
            - KOREAN_MEDICINE_HERBAL: 한약·첩약·탕약
            - MEDICATION: 약제 처방 단독
            - null: 진단 담보 전용이거나 분류 불가

            ── fixedBenefitCategory (정액형 담보 — 엄격하게 적용) ──
            - FRACTURE_DIAGNOSIS: 뼈 골절이 X-ray·CT로 확인되거나 강하게 의심되는 경우만.
              ※ 인대파열·연골파열·근육파열·염좌·타박상·삐끗·발목 삐끗은 반드시 null
            - SURGERY_BENEFIT: 수술이 명백히 수반되는 경우 (절제·봉합·절개 수술).
              ※ 단순 외래 처치·주사 시술·봉합 없는 외래는 제외
            - CANCER: 암(악성종양) 진단·치료가 명확한 경우
            - HOSPITALIZATION_DAILY: 입원이 명백히 필요한 중증 상태 (입원 치료 키워드가 있는 경우).
              ※ 통원 가능한 경증·외래 치료이면 null
            - BURN_DIAGNOSIS: 화상 진단이 명확한 경우 (중증 화상)
            - CEREBROVASCULAR: 뇌졸중·뇌경색·뇌출혈이 확인된 경우
            - DEATH_DISABILITY: 사망 또는 후유장해가 명확한 경우 (상해/질병 구분 불가 시)
            - null: 위 항목 중 명백히 해당하는 것이 없으면 반드시 null

            ── confidence ──
            - HIGH: 검색어만으로 모든 필드를 확실히 분류 가능
            - MEDIUM: 대부분 분류 가능하나 일부 필드 불확실
            - LOW: 핵심 필드(injuryDiseaseType 또는 careType)가 UNKNOWN이거나 추가 정보 필요

            ── needsUserConfirmation ──
            - true: confidence=LOW이거나 benefitType=UNKNOWN이거나 중요 필드가 UNKNOWN인 경우
            - false: confidence=HIGH이고 주요 필드 모두 확정된 경우

            ── nextQuestions (보험 관련 질문만) ──
            - needsUserConfirmation=true이면 아래 예시 중 관련 있는 2~3개 선택 (그대로 쓰거나 변형 가능):
              "사고(외상)로 인한 치료인가요, 아니면 질병 치료인가요?"
              "입원이 필요한 상황인가요, 아니면 외래로 치료 가능한가요?"
              "수술을 받았거나 받을 예정인가요?"
              "이 치료는 건강보험 급여 항목인가요, 비급여 항목인가요?"
            - needsUserConfirmation=false이면 반드시 빈 배열 []
            - 의학적 치료 방법·병원 선택·예후 관련 질문은 절대 포함하지 마세요
            """;

    public AiClassificationService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
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
        boolean isCancer    = containsAny(n, "암", "악성종양", "암수술", "항암", "방사선치료");
        boolean isFracture  = containsAny(n, "골절");
        boolean isBurn      = containsAny(n, "화상");
        boolean isCerebrovascular = containsAny(n, "뇌졸중", "뇌경색", "뇌출혈");
        boolean isDeathDisability = containsAny(n, "사망", "후유장해");
        boolean isInpatient = containsAny(n, "입원");

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
                : isCancer ? "CANCER"
                : isFracture ? "FRACTURE"
                : isBurn ? "BURN"
                : isCerebrovascular ? "CEREBROVASCULAR"
                : isDeathDisability ? "DEATH_DISABILITY"
                : isSurgery ? "SURGERY"
                : "GENERAL";
        String actualLossCategory = isHerbal ? "KOREAN_MEDICINE_HERBAL"
                : isKorean ? "KOREAN_MEDICINE"
                : isDental ? (isInjury ? "DENTAL_INJURY" : "DENTAL_DISEASE")
                : isRehab || isInjection ? "NON_COVERED_THREE"
                : isSurgery ? "GENERAL_SURGERY"
                : isInpatient ? "GENERAL_INPATIENT"
                : "GENERAL_OUTPATIENT";
        String fixedBenefitCategory = isCancer ? "CANCER"
                : isFracture ? "FRACTURE_DIAGNOSIS"
                : isBurn ? "BURN_DIAGNOSIS"
                : isCerebrovascular ? "CEREBROVASCULAR"
                : isDeathDisability ? "DEATH_DISABILITY"
                : isSurgery ? "SURGERY_BENEFIT"
                : isInpatient ? "HOSPITALIZATION_DAILY"
                : null;

        return AiClassificationResult.builder()
                .normalizedQuery(query)
                .injuryDiseaseType(injuryDiseaseType)
                .careType(careType)
                .benefitType("UNKNOWN")
                .treatmentCategory(treatmentCategory)
                .actualLossCategory(actualLossCategory)
                .fixedBenefitCategory(fixedBenefitCategory)
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
        body.put("max_tokens", 600);

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
                    .isValidMedicalQuery(node.path("isValidMedicalQuery").asBoolean(true))
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
