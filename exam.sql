-- ============================================================
-- MediCatch 진료 전 검색 룰 테이블 가이드
-- ============================================================
-- 파일 목적: 세 테이블의 각 컬럼 의미와 INSERT 작성법을 한국어로 정리
--
-- 테이블 3개의 관계 (흐름 요약):
--   사용자가 "MRI" 검색
--     └→ [treatment_rules] keyword/synonyms 매칭
--           ├→ actual_loss_category 값으로 [insurance_benefit_rules] 조회
--           │     → 실손보험 세대별 공제/보장비율 계산에 사용
--           └→ fixed_benefit_category 값으로 [fixed_benefit_match_rules] 조회
--                 → 사용자 담보명 DB에서 정액형 담보 항목 검색에 사용
-- ============================================================


-- ============================================================
-- 1. treatment_rules 테이블
-- ============================================================
-- 역할: 사용자 검색어 → 진료 분류 매핑 테이블
--   사용자가 입력한 검색어를 "어떤 종류의 진료인지" 분류한다.
--   이 분류 결과를 바탕으로 insurance_benefit_rules / fixed_benefit_match_rules를 조회한다.

-- ── 컬럼 설명 ──────────────────────────────────────────────
-- id                    : AUTO_INCREMENT PK. 직접 입력 불필요.
--
-- keyword               : 대표 검색어. 검색 매칭의 기준이 되는 키워드.
--                         예) '도수치료', 'MRI', '골절'
--                         ※ 중복 불가. 가능한 짧고 명확한 단어로.
--
-- synonyms              : 동의어 목록. 쉼표(,)로 구분하여 여러 개 입력.
--                         예) '도수,수기치료,재활도수'
--                         ※ 공백 없이 쉼표만 사용. keyword가 매칭 안 될 때 대신 매칭됨.
--
-- injury_disease_type   : 상해/질병 구분 코드.
--                         'INJURY'  - 상해 (사고·외상 원인)
--                         'DISEASE' - 질병 (내과적 원인)
--                         'UNKNOWN' - 검색 시점에 알 수 없음 (확인 필요)
--
-- care_type             : 진료 형태 코드. insurance_benefit_rules의 care_type과 연결됨.
--                         'OUTPATIENT' - 통원 (외래 진료)
--                         'INPATIENT'  - 입원
--                         'SURGERY'    - 수술
--                         'TEST'       - 검사 (영상, 내시경 등)
--                         'MEDICATION' - 약제 (처방·조제)
--                         'DIAGNOSIS'  - 진단 (진단비 담보 위주, 치료 미포함)
--
-- benefit_type          : 건강보험 급여 여부 코드.
--                         'COVERED'     - 급여 (건강보험 적용)
--                         'NON_COVERED' - 비급여 (건강보험 미적용)
--                         'MIXED'       - 급여+비급여 혼재 (케이스별 다름)
--                         'UNKNOWN'     - 검색 시점에 알 수 없음
--
-- treatment_category    : 치료 세부 분류. insurance_benefit_rules 필터링에 추가로 사용.
--                         'GENERAL'         - 일반 (분류 불필요한 기본 항목)
--                         'CANCER'          - 암 관련
--                         'FRACTURE'        - 골절
--                         'SURGERY'         - 수술
--                         'REHAB'           - 재활·도수치료·체외충격파
--                         'IMAGING'         - 영상검사 (MRI, CT, 초음파)
--                         'INJECTION'       - 주사
--                         'DENTAL'          - 치과
--                         'KOREAN_MEDICINE' - 한방 (한의원)
--                         'MEDICATION'      - 약제
--                         'BURN'            - 화상
--                         'DEATH_DISABILITY'- 사망·후유장해
--
-- actual_loss_category  : 실손보험 조회 키. insurance_benefit_rules.actual_loss_category와 1:N 연결.
--                         NULL이면 실손 조회를 건너뛴다 (정액형 전용 검색어일 때).
--                         주요 값:
--                           'GENERAL_OUTPATIENT'     - 일반 통원 실손
--                           'GENERAL_INPATIENT'      - 일반 입원 실손
--                           'GENERAL_SURGERY'        - 일반 수술 실손
--                           'MEDICATION'             - 약제 실손
--                           'NON_COVERED_THREE'      - 비급여 3종 (도수/주사/MRI)
--                           'DENTAL_INJURY'          - 치과 상해 실손
--                           'DENTAL_DISEASE'         - 치과 질병 실손
--                           'KOREAN_MEDICINE'        - 한방 비급여 실손
--                           'KOREAN_MEDICINE_COVERED'- 한방 급여 실손
--                           'KOREAN_MEDICINE_CHUNA'  - 추나요법 실손
--                           'KOREAN_MEDICINE_HERBAL' - 한약 실손
--
-- fixed_benefit_category: 정액형 담보 조회 키. fixed_benefit_match_rules.fixed_benefit_category와 1:N 연결.
--                         NULL이면 정액형 담보 조회를 건너뛴다 (실손 전용 검색어일 때).
--                         주요 값:
--                           'CANCER'             - 암 진단/수술/치료비 (상위 카테고리)
--                           'CANCER_DIAGNOSIS'   - 암 진단비
--                           'CANCER_SURGERY'     - 암 수술비
--                           'CANCER_TREATMENT'   - 항암 치료비
--                           'FRACTURE_DIAGNOSIS' - 골절 진단비
--                           'BURN_DIAGNOSIS'     - 화상 진단비
--                           'SURGERY_BENEFIT'    - 수술비
--                           'HOSPITALIZATION_DAILY' - 입원일당
--                           'DEATH_DISABILITY'   - 사망·후유장해
--                         ※ 'CANCER' 같은 상위 코드를 넣으면 'CANCER_DIAGNOSIS', 'CANCER_SURGERY' 등
--                           하위 코드를 가진 모든 fixed_benefit_match_rules가 함께 조회된다.
--                           (matchesFixedBenefitCategory 로직: ruleCategory.startsWith(category + '_'))
--
-- needs_user_confirmation: 검색 결과에 "추가 확인 필요" 경고를 표시할지 여부.
--                          TRUE  - 보장 여부 판단에 추가 정보 필요 (케이스별로 다름)
--                          FALSE - 일반적으로 보장 판단이 명확함
--
-- caution_message       : 검색 결과 화면에 표시할 주의 안내문.
--                         NULL이면 표시 안 함.
--                         예) '치아파절은 담보별 보장 제외 조건이 있을 수 있습니다.'
--
-- priority              : 검색 매칭 우선순위. 숫자가 낮을수록 먼저 매칭됨.
--                         keyword 완전 일치 → 동의어 완전 일치 → 부분 일치 순이며,
--                         동점일 때 priority 값으로 최종 순위를 결정한다.
--                         기본값 100. 중요 검색어는 10~50, 상세 검색어는 100~200 권장.
--
-- is_active             : 해당 룰 활성 여부. FALSE면 조회에서 제외된다.
--                         기본값 TRUE.
--
-- created_at / updated_at: DB가 자동 기록. 입력 불필요.
-- ──────────────────────────────────────────────────────────

-- ── INSERT 예시 ────────────────────────────────────────────

-- [예시 1] 단순 질병 통원 검색어 (실손만, 정액형 없음)
INSERT INTO treatment_rules
    (keyword, synonyms, injury_disease_type, care_type, benefit_type,
     treatment_category, actual_loss_category, fixed_benefit_category,
     needs_user_confirmation, caution_message, priority)
SELECT
    '비염',                                          -- keyword
    '알레르기비염,만성비염,코막힘,콧물',               -- synonyms (쉼표 구분, 공백 없이)
    'DISEASE',                                       -- injury_disease_type
    'OUTPATIENT',                                    -- care_type
    'COVERED',                                       -- benefit_type (급여 위주)
    'GENERAL',                                       -- treatment_category
    'GENERAL_OUTPATIENT',                            -- actual_loss_category (통원 실손 조회)
    NULL,                                            -- fixed_benefit_category (정액형 없음)
    FALSE,                                           -- needs_user_confirmation
    NULL,                                            -- caution_message
    120                                              -- priority
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '비염');

-- [예시 2] 수술이 포함된 복합 분류 (실손 + 정액 수술비)
INSERT INTO treatment_rules
    (keyword, synonyms, injury_disease_type, care_type, benefit_type,
     treatment_category, actual_loss_category, fixed_benefit_category,
     needs_user_confirmation, caution_message, priority)
SELECT
    '회전근개파열',
    '어깨파열,회전근,어깨힘줄파열,어깨수술',
    'INJURY',
    'SURGERY',
    'MIXED',                    -- 급여/비급여 혼재
    'SURGERY',
    'GENERAL_SURGERY',          -- 수술 실손 조회
    'SURGERY_BENEFIT',          -- 수술비 정액형 담보도 함께 조회
    TRUE,
    '수술 여부, 수술 분류에 따라 정액 수술비와 실손 보장 기준이 달라질 수 있습니다.',
    130
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '회전근개파열');

-- [예시 3] 정액 진단비만 있는 검색어 (실손 없음)
INSERT INTO treatment_rules
    (keyword, synonyms, injury_disease_type, care_type, benefit_type,
     treatment_category, actual_loss_category, fixed_benefit_category,
     needs_user_confirmation, caution_message, priority)
SELECT
    '뇌졸중',
    '뇌경색,뇌출혈,중풍,뇌혈관질환',
    'DISEASE',
    'DIAGNOSIS',
    'UNKNOWN',
    'GENERAL',
    NULL,                    -- 실손 조회 없음 (진단비 위주)
    'CEREBROVASCULAR',       -- 정액형 뇌혈관 진단비 조회
    TRUE,
    '뇌졸중 진단비는 진단명과 뇌혈관 담보 종류에 따라 보장 여부가 달라질 수 있습니다.',
    140
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '뇌졸중');

-- ★ 잘못된 예시 (하지 말 것)
-- fixed_benefit_category에 없는 값 사용 → 정액형 조회 결과 없음
-- INSERT ... 'MY_CUSTOM_CAT' ...  ← fixed_benefit_match_rules에 해당 값이 없으면 빈 결과
-- synonyms에 공백 포함 → 매칭 오류 가능
-- INSERT ... '도수, 수기치료' ... ← '도수'와 ' 수기치료' 로 파싱됨 (앞에 공백 붙음)


-- ============================================================
-- 2. insurance_benefit_rules 테이블
-- ============================================================
-- 역할: 실손보험 세대별 보장 계산 룰 테이블
--   treatment_rules.actual_loss_category 로 조회되어
--   "세대별로 얼마나 돌려받는지" 계산 기준을 제공한다.
--   ClaimMatchingService와 PreTreatmentSearchService 모두에서 사용된다.

-- ── 컬럼 설명 ──────────────────────────────────────────────
-- id                : AUTO_INCREMENT PK. 직접 입력 불필요.
--
-- generation_code   : 실손보험 세대 코드. 아래 6가지 고정값만 사용.
--                     '1-d' - 1세대 손해보험 (~2009년 9월 이전 가입)
--                     '1-h' - 1세대 생명보험 (~2009년 9월 이전 가입)
--                     '2'   - 2세대 (2009.10 ~ 2017.03 가입)
--                     '3-s' - 3세대 표준 실손 (2017.04 ~ 2021.06 가입)
--                     '3-c' - 3세대 착한실손 (2017.04 ~ 2021.06, 비급여 특약 분리)
--                     '4'   - 4세대 (2021.07 ~ 현재 가입)
--
-- care_type         : 진료 형태.
--                     'OUTPATIENT' - 통원
--                     'INPATIENT'  - 입원
--                     'SURGERY'    - 수술
--                     'MEDICATION' - 약제
--
-- benefit_type      : 급여 여부.
--                     'COVERED'     - 급여
--                     'NON_COVERED' - 비급여
--                     'MIXED'       - 혼합 (주로 치과 등 케이스별)
--
-- treatment_category: 치료 분류. NULL 또는 'GENERAL'이면 해당 care_type의 기본 룰로 사용.
--                     같은 care_type + benefit_type 내에서 세부 분류가 필요할 때 사용.
--                     예) DENTAL, REHAB, INJECTION, IMAGING, KOREAN_MEDICINE 등
--
-- actual_loss_category: treatment_rules.actual_loss_category 와 연결되는 핵심 조인 키.
--                       ClaimMatchingService에서는 'GENERAL_OUTPATIENT' 룰을 기본 계산에 사용.
--                       주요 값:
--                         'GENERAL_OUTPATIENT'      - 일반 통원 기본 룰
--                         'GENERAL_INPATIENT'       - 일반 입원 기본 룰
--                         'GENERAL_SURGERY'         - 일반 수술 기본 룰
--                         'MEDICATION'              - 약제 기본 룰
--                         'NON_COVERED_THREE'       - 비급여 3종 특약 (도수/주사/MRI)
--                         'DENTAL_INJURY'           - 치과 상해
--                         'DENTAL_DISEASE'          - 치과 질병
--                         'KOREAN_MEDICINE_COVERED' - 한방 급여
--                         'KOREAN_MEDICINE'         - 한방 비급여
--                         'KOREAN_MEDICINE_CHUNA'   - 추나요법
--                         'KOREAN_MEDICINE_HERBAL'  - 한약
--
-- reimbursement_rate: 보험사 지급 비율 (%). 실제 보험금 = 의료비 × (reimbursement_rate / 100).
--                     예) 80 → 의료비의 80% 지급
--                     보장 제외(is_excluded=TRUE)인 경우 0 으로 입력.
--
-- patient_copay_rate: 환자 본인 부담 비율 (%).
--                     reimbursement_rate + patient_copay_rate = 100 이 되어야 정상.
--                     예) 20 → 의료비의 20% 본인 부담
--
-- fixed_deductible  : 통원 정액 공제금 (원). 보험금 지급 전 먼저 차감되는 금액.
--                     예) 10000 → 1만원 공제 후 나머지 지급
--                     입원은 보통 NULL (일당 방식).
--
-- deductible_method : 공제 방식.
--                     'FIXED_ONLY'        - fixed_deductible만 차감 (1세대 방식)
--                     'MAX_FIXED_OR_RATE' - max(공제금, 본인부담율×의료비) 차감 (2~4세대 방식)
--                     'EXCLUDED'          - 해당 항목 보장 전혀 없음 (is_excluded=TRUE와 함께 사용)
--
-- limit_amount      : 연간 보장 한도액 (원). NULL이면 한도 없음.
--                     예) 3500000 → 연 350만원 한도
--                     비급여 3종 특약(3-c, 4세대)에 주로 사용.
--
-- limit_count       : 연간 보장 한도 횟수. NULL이면 횟수 제한 없음.
--                     예) 50 → 연 50회 한도
--
-- requires_rider    : 해당 보장을 받으려면 별도 특약 가입이 필요한지 여부.
--                     TRUE  - 특약 필요 (기본 계약에 포함 안 됨)
--                     FALSE - 기본 계약에 포함
--
-- is_excluded       : 해당 세대에서 이 항목이 아예 보장 제외인지 여부.
--                     TRUE  - 보장 없음 (예: 1세대 치과 질병, 2세대 이후 한약 비급여)
--                     FALSE - 보장 있음
--
-- note              : 이 룰에 대한 설명/주의사항. 화면에 직접 표시될 수도 있음.
--
-- priority          : 조회 우선순위. 같은 조건에서 여러 룰이 있을 때 낮은 숫자가 먼저.
--                     기본값 100.
--
-- is_active         : 활성 여부. FALSE면 조회에서 제외.
-- ──────────────────────────────────────────────────────────

-- ── INSERT 예시 ────────────────────────────────────────────

-- [예시 1] 새 actual_loss_category 'GENERAL_SURGERY' 룰 추가 (세대 전체)
--   : 수술 실손 룰이 없을 때 treatment_rules에 actual_loss_category='GENERAL_SURGERY'를
--     사용하려면 이 테이블에 아래처럼 세대별 6개 행이 필요.
INSERT INTO insurance_benefit_rules
    (generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
     reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
     limit_amount, limit_count, requires_rider, is_excluded, note, priority)
SELECT gen, 'SURGERY', 'COVERED', 'GENERAL', 'GENERAL_SURGERY',
       reimb, copay, NULL, method, NULL, NULL, FALSE, FALSE, memo, prio
FROM (
    SELECT '1-d' gen, 100 reimb, 0 copay, 'FIXED_ONLY' method,  '1세대 손해보험 수술 급여 기준' memo, 310 prio
    UNION ALL SELECT '1-h', 80, 20, 'FIXED_ONLY',         '1세대 생명보험 수술 급여 기준', 320
    UNION ALL SELECT '2',   80, 20, 'MAX_FIXED_OR_RATE',  '2세대 수술 급여 기준',         330
    UNION ALL SELECT '3-s', 80, 20, 'MAX_FIXED_OR_RATE',  '3세대 표준 수술 급여 기준',    340
    UNION ALL SELECT '3-c', 80, 20, 'MAX_FIXED_OR_RATE',  '3세대 착한실손 수술 급여 기준',350
    UNION ALL SELECT '4',   80, 20, 'MAX_FIXED_OR_RATE',  '4세대 수술 급여 기준',         360
) t
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = t.gen
      AND r.care_type = 'SURGERY'
      AND r.benefit_type = 'COVERED'
      AND r.actual_loss_category = 'GENERAL_SURGERY'
);

-- [예시 2] 입원 실손 룰 추가 (세대별 + 급여/비급여 각각)
INSERT INTO insurance_benefit_rules
    (generation_code, care_type, benefit_type, treatment_category, actual_loss_category,
     reimbursement_rate, patient_copay_rate, fixed_deductible, deductible_method,
     requires_rider, is_excluded, note, priority)
SELECT gen, 'INPATIENT', btype, 'GENERAL', 'GENERAL_INPATIENT',
       reimb, copay, NULL, method, FALSE, FALSE, memo, prio
FROM (
    -- 1세대 손해보험
    SELECT '1-d' gen, 'COVERED' btype, 100 reimb, 0 copay, 'FIXED_ONLY' method, '1세대 손보 입원 급여' memo, 410 prio
    UNION ALL SELECT '1-d', 'NON_COVERED', 100, 0, 'FIXED_ONLY', '1세대 손보 입원 비급여', 411
    -- 1세대 생명보험
    UNION ALL SELECT '1-h', 'COVERED', 80, 20, 'FIXED_ONLY', '1세대 생보 입원 급여', 420
    UNION ALL SELECT '1-h', 'NON_COVERED', 80, 20, 'FIXED_ONLY', '1세대 생보 입원 비급여', 421
    -- 2세대
    UNION ALL SELECT '2', 'COVERED', 90, 10, 'MAX_FIXED_OR_RATE', '2세대 입원 급여 (본인부담 10%)', 430
    UNION ALL SELECT '2', 'NON_COVERED', 80, 20, 'MAX_FIXED_OR_RATE', '2세대 입원 비급여', 431
    -- 3세대 표준
    UNION ALL SELECT '3-s', 'COVERED', 90, 10, 'MAX_FIXED_OR_RATE', '3세대 표준 입원 급여', 440
    UNION ALL SELECT '3-s', 'NON_COVERED', 80, 20, 'MAX_FIXED_OR_RATE', '3세대 표준 입원 비급여', 441
    -- 3세대 착한실손
    UNION ALL SELECT '3-c', 'COVERED', 90, 10, 'MAX_FIXED_OR_RATE', '3세대 착한실손 입원 급여', 450
    UNION ALL SELECT '3-c', 'NON_COVERED', 70, 30, 'MAX_FIXED_OR_RATE', '3세대 착한실손 입원 비급여', 451
    -- 4세대
    UNION ALL SELECT '4', 'COVERED', 90, 10, 'MAX_FIXED_OR_RATE', '4세대 입원 급여', 460
    UNION ALL SELECT '4', 'NON_COVERED', 70, 30, 'MAX_FIXED_OR_RATE', '4세대 입원 비급여', 461
) t
WHERE NOT EXISTS (
    SELECT 1 FROM insurance_benefit_rules r
    WHERE r.generation_code = t.gen
      AND r.care_type = 'INPATIENT'
      AND r.benefit_type = t.btype
      AND r.actual_loss_category = 'GENERAL_INPATIENT'
);

-- ★ 잘못된 예시 (하지 말 것)
-- reimbursement_rate + patient_copay_rate ≠ 100
-- INSERT ... (80, 30, ...) ...  ← 합이 110이면 계산 오류
-- is_excluded=TRUE인데 reimbursement_rate=80
-- INSERT ... TRUE, 80 ...       ← 제외 항목은 reimbursement_rate=0, deductible_method='EXCLUDED' 사용
-- 새 generation_code 사용 금지
-- INSERT ... '5' ...            ← InsuranceGenerationUtils가 인식 못 함. 6개 값만 사용.


-- ============================================================
-- 3. fixed_benefit_match_rules 테이블
-- ============================================================
-- 역할: 정액형 담보 매칭 룰 테이블
--   사용자의 보험 담보명 DB(coverage_items)를 검색하여
--   "이 검색어에 해당하는 정액형 담보를 갖고 있는지" 확인하는 기준을 제공한다.
--   예) '골절' 검색 → FRACTURE_DIAGNOSIS 룰 → 사용자 담보명 중 '골절진단'이 포함된 항목 찾기

-- ── 컬럼 설명 ──────────────────────────────────────────────
-- id                    : AUTO_INCREMENT PK. 직접 입력 불필요.
--
-- fixed_benefit_category: treatment_rules.fixed_benefit_category 와 연결되는 조인 키.
--                         같은 fixed_benefit_category로 여러 행을 만들면 모두 조회된다.
--                         예) 'CANCER' 카테고리 treatment_rule → 'CANCER_DIAGNOSIS',
--                             'CANCER_SURGERY', 'CANCER_TREATMENT' 룰이 전부 조회됨
--                             (matchesFixedBenefitCategory: startsWith('CANCER_') 로 하위 포함)
--
-- display_name          : 화면에 표시되는 담보 그룹명.
--                         예) '암 진단비', '골절 진단비', '입원일당'
--                         사용자에게 직접 보이는 문구이므로 한국어로 명확하게 작성.
--
-- match_keywords        : 사용자 담보명(coverage_items.item_name)과 매칭할 키워드 목록.
--                         쉼표(,)로 구분. 하나라도 담보명에 포함되면 매칭.
--                         예) '골절진단,중대골절진단,5대골절'
--                         ※ 공백 없이 쉼표만 사용.
--                         ※ 담보명은 소문자+공백제거 후 비교되므로
--                           키워드도 가능하면 공백 없이 작성 권장.
--
-- exclude_keywords      : 담보명에 포함 시 매칭에서 제외할 키워드.
--                         쉼표(,)로 구분. NULL이면 제외 조건 없음.
--                         예) '수술,입원,항암'
--                         ※ 사용 목적: '암진단' 키워드로 '암진단비'는 잡되
--                           '암수술진단' 같은 다른 담보는 걸러낼 때 사용.
--                         ※ 주의: 담보명 자체의 제외 문구 필터링은 별도 로직
--                           (isExcludedByItemName)이 처리하므로 여기에 넣지 않아도 됨.
--                           예) '[골절진단비(치아파절 제외)]' → 치아파절 검색 시 자동 필터링됨.
--
-- description           : 이 룰에 대한 내부 설명. 화면에 표시되지 않음.
--
-- priority              : 같은 fixed_benefit_category 내에서 표시 순서.
--                         낮은 숫자가 먼저 표시됨. 기본값 100.
--
-- is_active             : 활성 여부. FALSE면 조회에서 제외.
-- ──────────────────────────────────────────────────────────

-- ── INSERT 예시 ────────────────────────────────────────────

-- [예시 1] 뇌혈관 진단비 룰 추가
--   treatment_rules에 fixed_benefit_category='CEREBROVASCULAR' 를 사용하려면
--   이 테이블에 아래처럼 row가 있어야 함.
INSERT INTO fixed_benefit_match_rules
    (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT
    'CEREBROVASCULAR',                                   -- fixed_benefit_category
    '뇌혈관 진단비',                                      -- display_name (화면 표시명)
    '뇌혈관진단,뇌졸중진단,뇌경색진단,뇌출혈진단,뇌혈관',  -- match_keywords (쉼표 구분)
    NULL,                                                -- exclude_keywords (없으면 NULL)
    '뇌졸중/뇌혈관 관련 정액형 진단비 담보를 찾습니다.',   -- description
    10                                                   -- priority
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'CEREBROVASCULAR');

-- [예시 2] 심장 질환 진단비 (하위 카테고리 방식으로 분리)
--   treatment_rules.fixed_benefit_category = 'HEART'
--   → 'HEART_DIAGNOSIS', 'HEART_SURGERY' 두 룰이 모두 조회됨
INSERT INTO fixed_benefit_match_rules
    (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'HEART_DIAGNOSIS', '심장 진단비', '급성심근경색진단,허혈성심장진단,심근경색,협심증진단', '수술', '심장 진단 관련 정액형 담보', 10
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'HEART_DIAGNOSIS');

INSERT INTO fixed_benefit_match_rules
    (fixed_benefit_category, display_name, match_keywords, exclude_keywords, description, priority)
SELECT 'HEART_SURGERY', '심장 수술비', '심장수술,판막수술,관상동맥수술', '진단', '심장 수술 관련 정액형 담보', 20
WHERE NOT EXISTS (SELECT 1 FROM fixed_benefit_match_rules WHERE fixed_benefit_category = 'HEART_SURGERY');

-- [예시 3] 기존 룰에 키워드 추가 (UPDATE 방식)
--   새 키워드가 생겼을 때 기존 행을 수정.
UPDATE fixed_benefit_match_rules
SET match_keywords = CONCAT(match_keywords, ',중증골절진단')
WHERE fixed_benefit_category = 'FRACTURE_DIAGNOSIS'
  AND match_keywords NOT LIKE '%중증골절진단%';

-- ★ 잘못된 예시 (하지 말 것)
-- match_keywords에 공백 포함 → 매칭 오류
-- INSERT ... '골절 진단, 중대 골절' ...  ← '골절 진단'은 소문자+공백제거 후 '골절진단'이 되므로
--                                          실제로는 문제없지만, 원칙적으로 공백 없이 작성 권장
-- exclude_keywords에 너무 많은 단어 → 정상 담보까지 필터링될 수 있음
-- fixed_benefit_category에 treatment_rules에 없는 값 사용 →
--   treatment_rules에 해당 category가 없으면 이 룰은 절대 조회되지 않음


-- ============================================================
-- 4. 세 테이블 연계 INSERT 전체 예시 (무릎통증)
-- ============================================================
-- 무릎통증 검색어 추가 시 필요한 전체 INSERT 흐름

-- Step 1: treatment_rules에 검색어 등록
INSERT INTO treatment_rules
    (keyword, synonyms, injury_disease_type, care_type, benefit_type,
     treatment_category, actual_loss_category, fixed_benefit_category,
     needs_user_confirmation, caution_message, priority)
SELECT
    '무릎통증',
    '슬관절통증,무릎관절염,무릎연골,반월상연골판,슬개골',
    'UNKNOWN',        -- 상해/질병 검색 시점 불명
    'OUTPATIENT',
    'MIXED',
    'GENERAL',
    'GENERAL_OUTPATIENT',  -- 통원 실손 조회 → insurance_benefit_rules에 이미 있음
    NULL,                  -- 정액 담보 없음 (무릎은 별도 진단비 없음)
    TRUE,
    '통증 원인(상해/질병)과 치료 내용(주사, 물리치료, 수술 등)에 따라 실손 보장 기준이 달라집니다.',
    150
WHERE NOT EXISTS (SELECT 1 FROM treatment_rules WHERE keyword = '무릎통증');
-- ↑ actual_loss_category = 'GENERAL_OUTPATIENT' 는 이미 insurance_benefit_rules에 있으므로
--   insurance_benefit_rules INSERT 불필요.

-- Step 2: 만약 새 actual_loss_category를 쓴다면 insurance_benefit_rules에도 추가 필요
--   예) actual_loss_category = 'KNEE_JOINT' 를 쓰고 싶다면:
--   → 위 예시 1 (GENERAL_SURGERY 패턴)처럼 6개 세대 × 급여/비급여 = 최대 12개 행 추가 필요

-- Step 3: 정액 담보가 필요하면 fixed_benefit_match_rules에도 추가 필요
--   무릎통증은 정액 담보 없으므로 불필요. 만약 '관절 진단비'가 있다면:
--   INSERT INTO fixed_benefit_match_rules ... fixed_benefit_category='JOINT_DIAGNOSIS' ...
--   + treatment_rules.fixed_benefit_category = 'JOINT_DIAGNOSIS' 로 업데이트
