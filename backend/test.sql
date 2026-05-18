-- ============================================================
-- 테스트 데이터 (실 Codef API 응답 기반 / 다양한 케이스 포함)
-- 테스트 계정: test@medicatch.com (user_id=2, codef_id='test')
-- 실행: mysql -u root -p < test.sql
-- ============================================================

-- ── 유저 (테스트 계정) ──────────────────────────────────────
USE medicatch_user;
INSERT INTO users (email, codef_id, password_hash, name, birth_date, gender, created_at, updated_at)
VALUES ('test@medicatch.com', 'test', '$2b$10$Nt6r8LmhSKhZmD60LqPZ2.EWb62KpEup5wiiXKKX55c3YDjRCZNmC', '김건강', '1989-05-15', 'M', NOW(), NOW())
ON DUPLICATE KEY UPDATE codef_id='test', password_hash='$2b$10$Nt6r8LmhSKhZmD60LqPZ2.EWb62KpEup5wiiXKKX55c3YDjRCZNmC', updated_at=NOW();

-- ── 기존 테스트 데이터 초기화 ────────────────────────────────
USE medicatch_insurance;
DELETE FROM coverage_items WHERE policy_id IN (SELECT id FROM (SELECT id FROM policies WHERE user_id = 2) AS p);
DELETE FROM coverage_comparison WHERE user_id = 2;
DELETE FROM policies WHERE user_id = 2;

-- ── 보험 계약 (policies) ────────────────────────────────────
-- 케이스1: 삼성화재 정액형 건강보험 (활성, 보험료 정상, 주력 보장 상품)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'SS-2019-00123456', '삼성화재해상보험', 'HEALTH', '2019-03-01', '2049-03-01', TRUE, 87500, 87500, '월납', '10년납', FALSE, '무배당 삼성화재 건강보험(갱신형)', NOW(), NOW());

-- 케이스2: DB손보 그린라이프 1세대 실손보험 (활성, 1세대 실손으로 보장 범위 넓음)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'DB-2009-00567890', 'DB손해보험', 'SUPPLEMENTARY', '2009-05-01', '2029-05-01', TRUE, 32000, 32000, '월납', '전기납', TRUE, 'DB 그린라이프 실손의료보험(1세대)', NOW(), NOW());

-- 케이스3: 한화생명 복합 건강보험 (활성, 정액형 + 실손 포함)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'HW-2015-00234567', '한화생명', 'HEALTH', '2015-08-15', '2045-08-15', TRUE, 125000, 125000, '월납', '20년납', TRUE, '한화생명 뉴라이프 건강보험', NOW(), NOW());

-- 케이스4: 현대해상 2세대 실손 (활성, 2009.10~2017.03 가입)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'HD-2013-00456789', '현대해상', 'SUPPLEMENTARY', '2013-06-01', '2033-06-01', TRUE, 28000, 28000, '월납', '전기납', TRUE, '현대해상 실손의료보험(2세대)', NOW(), NOW());

-- 케이스4-2: KB손보 3세대 실손 (활성, 2017.04~2021.06 가입, 도수치료 등 비급여 특약)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'KB-2017-00345678', 'KB손해보험', 'SUPPLEMENTARY', '2017-04-01', '2037-04-01', TRUE, 45000, 45000, '월납', '전기납', TRUE, 'KB 실손의료보험(3세대, 비급여특약 포함)', NOW(), NOW());

-- 케이스4-3: 메리츠화재 4세대 실손 (활성, 2021.07 이후 가입, 급여/비급여 분리)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'MZ-2022-00078901', '메리츠화재', 'SUPPLEMENTARY', '2022-03-01', '2042-03-01', TRUE, 38000, 38000, '월납', '전기납', TRUE, '메리츠화재 실손의료보험(4세대)', NOW(), NOW());

-- 케이스5: 삼성화재 만기 정액형 (만료됨 - 오래된 상품)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'SS-2001-00011111', '삼성화재해상보험', 'HEALTH', '2001-01-01', '2021-01-01', FALSE, NULL, NULL, NULL, NULL, FALSE, '삼성화재 암보험(만기)', NOW(), NOW());

-- 케이스6: 메리츠화재 해지된 보험 (해지)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'MZ-2012-00022222', '메리츠화재', 'HEALTH', '2012-06-01', '2032-06-01', FALSE, NULL, NULL, NULL, NULL, FALSE, '메리츠 무배당 건강보험(해지)', NOW(), NOW());

-- 케이스7: 현대해상 재물보험 (만기, 재물 타입)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'HD-2018-00033333', '현대해상', 'PROPERTY', '2018-01-01', '2023-01-01', FALSE, NULL, 50000, '연납', NULL, FALSE, '현대해상 화재보험', NOW(), NOW());

-- 케이스8: 교보생명 저축성 보험 (활성, 저축형)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'KY-2020-00044444', '교보생명', 'SAVINGS', '2020-09-01', '2040-09-01', TRUE, 200000, 200000, '월납', '10년납', FALSE, '교보생명 무배당 저축보험', NOW(), NOW());

-- ── 담보 항목 (coverage_items) ──────────────────────────────
-- 케이스1 (삼성화재 정액형): 암/골절/수술/입원일당 등 다양한 정액 담보
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '암진단비(일반암)', 'OUTPATIENT', 30000000, '최초진단', TRUE, 1 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '암진단비(유사암)', 'OUTPATIENT', 3000000, '최초진단', TRUE, 2 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '질병입원일당', 'INPATIENT', 50000, '입원1일당', TRUE, 3 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '상해입원일당', 'INPATIENT', 50000, '입원1일당', TRUE, 4 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '골절진단비', 'OUTPATIENT', 500000, NULL, TRUE, 5 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '질병수술비(1종)', 'SURGERY', 300000, '수술 1회당', TRUE, 6 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '질병수술비(2종)', 'SURGERY', 600000, '수술 1회당', TRUE, 7 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '상해사망', 'OUTPATIENT', 100000000, NULL, TRUE, 8 FROM policies WHERE policy_number = 'SS-2019-00123456' AND user_id = 2;

-- 케이스2 (DB손보 1세대 실손): 실손의료비 담보 (입원/통원/약제)
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(입원)', 'INPATIENT', 100000000, '급여+비급여80%, 비급여100%', TRUE, 1 FROM policies WHERE policy_number = 'DB-2009-00567890' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원-의원)', 'OUTPATIENT', 100000, '공제금 1만원', TRUE, 2 FROM policies WHERE policy_number = 'DB-2009-00567890' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원-병원)', 'OUTPATIENT', 200000, '공제금 1.5만원', TRUE, 3 FROM policies WHERE policy_number = 'DB-2009-00567890' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원-종합병원)', 'OUTPATIENT', 300000, '공제금 2만원', TRUE, 4 FROM policies WHERE policy_number = 'DB-2009-00567890' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(약제)', 'MEDICATION', 100000, '공제금 8천원', TRUE, 5 FROM policies WHERE policy_number = 'DB-2009-00567890' AND user_id = 2;

-- 케이스3 (한화생명 복합): 정액 + 실손 혼합
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '암진단비(일반암)', 'OUTPATIENT', 50000000, '최초진단', TRUE, 1 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(입원)', 'INPATIENT', 100000000, '급여90%, 비급여80%', TRUE, 2 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원)', 'OUTPATIENT', 300000, '공제금 2만원', TRUE, 3 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '뇌졸중진단비', 'OUTPATIENT', 20000000, '최초진단', TRUE, 4 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '급성심근경색진단비', 'OUTPATIENT', 20000000, '최초진단', TRUE, 5 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '장기요양간병비', 'INPATIENT', 3000000, '연 1회', TRUE, 6 FROM policies WHERE policy_number = 'HW-2015-00234567' AND user_id = 2;

-- 케이스4 (KB손보 2세대 실손): 급여/비급여 분리 구조
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(급여-입원)', 'INPATIENT', 100000000, '급여90%', TRUE, 1 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(비급여-입원)', 'INPATIENT', 100000000, '비급여80%', TRUE, 2 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(급여-통원)', 'OUTPATIENT', 200000, '급여90%, 공제금1만원', TRUE, 3 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(비급여-통원)', 'OUTPATIENT', 200000, '비급여80%, 공제금1만원', TRUE, 4 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '도수치료/체외충격파/증식치료', 'OUTPATIENT', 3500000, '연간 350만원 한도', TRUE, 5 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '비급여주사제', 'MEDICATION', 2500000, '연간 250만원 한도', TRUE, 6 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, 'MRI/MRA', 'OUTPATIENT', 3000000, '연간 300만원 한도', TRUE, 7 FROM policies WHERE policy_number = 'KB-2017-00345678' AND user_id = 2;

-- 케이스4 (현대해상 2세대 실손): 입원/통원 비급여 80% 보장, 통원 한도 없음
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(입원)', 'INPATIENT', 100000000, '급여+비급여80%, 공제금 없음', TRUE, 1 FROM policies WHERE policy_number = 'HD-2013-00456789' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원-의원)', 'OUTPATIENT', 100000, '급여+비급여80%, 공제금 1만원', TRUE, 2 FROM policies WHERE policy_number = 'HD-2013-00456789' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(통원-병원)', 'OUTPATIENT', 150000, '급여+비급여80%, 공제금 1.5만원', TRUE, 3 FROM policies WHERE policy_number = 'HD-2013-00456789' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(약제)', 'MEDICATION', 100000, '급여+비급여80%, 공제금 8천원', TRUE, 4 FROM policies WHERE policy_number = 'HD-2013-00456789' AND user_id = 2;

-- 케이스4-3 (메리츠화재 4세대 실손): 급여/비급여 완전 분리, 비급여 자기부담 30%
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(급여-입원)', 'INPATIENT', 100000000, '급여90%', TRUE, 1 FROM policies WHERE policy_number = 'MZ-2022-00078901' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(비급여-입원)', 'INPATIENT', 100000000, '비급여70%, 연간 한도', TRUE, 2 FROM policies WHERE policy_number = 'MZ-2022-00078901' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(급여-통원)', 'OUTPATIENT', 200000, '급여90%, 공제금1만원', TRUE, 3 FROM policies WHERE policy_number = 'MZ-2022-00078901' AND user_id = 2;
INSERT INTO coverage_items (policy_id, item_name, category, max_benefit_amount, conditions, is_covered, priority)
SELECT id, '실손의료비(비급여-통원)', 'OUTPATIENT', 200000, '비급여70%, 공제금3만원', TRUE, 4 FROM policies WHERE policy_number = 'MZ-2022-00078901' AND user_id = 2;

-- ── 보장 비교 통계 (coverage_comparison) ───────────────────
-- 실 Codef API resFlatRateStatisticsList 기반
-- selfCoverageAmount vs avgGroupCoverageAmount 다양한 케이스:
--   - self > avg * 1.2 : 충분 (GOOD)
--   - avg * 0.8 <= self <= avg * 1.2 : 적정 (NORMAL)
--   - 0 < self < avg * 0.8 : 부족 (LOW)
--   - self = 0 : 미가입 (MISSING)

INSERT INTO coverage_comparison (user_id, codef_id, coverage_name, coverage_code, self_coverage_amount, avg_group_coverage_amount, created_at, updated_at)
VALUES
-- GOOD: 암진단 보장 충분 (동일연령 평균 2천만원, 내 보장 3천만원)
(2, 'test', '암진단비', 'CANCER_DIAG', 30000000, 20000000, NOW(), NOW()),
-- NORMAL: 골절진단 적정 (평균 50만원, 내 보장 50만원)
(2, 'test', '골절진단비', 'FRACTURE_DIAG', 500000, 500000, NOW(), NOW()),
-- LOW: 질병입원일당 부족 (평균 10만원, 내 보장 5만원)
(2, 'test', '질병입원일당', 'DISEASE_INPATIENT', 50000, 100000, NOW(), NOW()),
-- LOW: 상해입원일당 부족 (평균 8만원, 내 보장 5만원)
(2, 'test', '상해입원일당', 'INJURY_INPATIENT', 50000, 80000, NOW(), NOW()),
-- MISSING: 뇌혈관질환 진단비 미가입
(2, 'test', '뇌혈관질환진단비', 'CEREBROVASCULAR_DIAG', 0, 25000000, NOW(), NOW()),
-- MISSING: 치매간병 전혀 없음
(2, 'test', '치매간병비', 'DEMENTIA_CARE', 0, 15000000, NOW(), NOW()),
-- GOOD: 상해사망 충분 (평균 5천만원, 내 보장 1억원)
(2, 'test', '상해사망보험금', 'INJURY_DEATH', 100000000, 50000000, NOW(), NOW()),
-- LOW: 수술비 부족 (평균 100만원, 내 보장 30만원)
(2, 'test', '질병수술비', 'DISEASE_SURGERY', 300000, 1000000, NOW(), NOW()),
-- MISSING: 통원의료비(비급여) 미가입
(2, 'test', '통원의료비(비급여)', 'OUTPATIENT_NON_COVERED', 0, 20000000, NOW(), NOW()),
-- NORMAL: 입원의료비 실손 보장 (평균 1억, 내 보장 1억)
(2, 'test', '입원의료비(실손)', 'INPATIENT_ACTUAL_LOSS', 100000000, 100000000, NOW(), NOW());

-- ── 진료 기록 (medical_records) ─────────────────────────────
USE medicatch_health;
DELETE FROM medication_details WHERE user_id = 2;
DELETE FROM medical_records WHERE user_id = 2;

-- ============================================================
-- 치과 (AK 코드) - 세대별 보장 차이 테스트
-- 1세대: 치과 질병 완전 면책
-- 2세대+: 급여 본인부담분만 보장 (비급여 제외)
-- ============================================================

-- AK021 충치 외래 의원 (급여만, 비급여 없음)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-11-10', '한빛치과의원', '치과보존과', '(양방)상아질의 우식', 'AK021', '외래', 38500, 55000, 16500, 0, 'UNCLAIMED', NOW(), NOW());

-- AK0401 치수염 외래 의원 (급여만)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-10-15', '한빛치과의원', '치과보존과', '(양방)비가역적 치수염', 'AK0401', '외래', 57000, 81300, 24300, 0, 'UNCLAIMED', NOW(), NOW());

-- AK0520 치주농양 외래 의원 (급여만)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-09-20', '한빛치과의원', '치주과', '(양방)동이 없는 잇몸 기원의 치주농양', 'AK0520', '외래', 72800, 104000, 31200, 0, 'UNCLAIMED', NOW(), NOW());

-- AK0119 매복치 외래 종합병원 (급여+비급여 혼합 - 수술료 비급여 포함)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-08-05', '연세대학교치과병원', '구강악안면외과', '(양방)상세불명의 매복치', 'AK0119', '외래', 158000, 264000, 106000, 68000, 'UNCLAIMED', NOW(), NOW());

-- AK0800 임플란트 치과의원 (비급여 전액 - 전 세대 실손 미보장)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-07-15', '한빛치과의원', '치과보철과', '(양방)치아 및 지지구조의 기타 장애', 'AK0800', '외래', 0, 0, 0, 1200000, 'UNCLAIMED', NOW(), NOW());

-- ============================================================
-- 상해 (AS 코드) - 모든 세대 실손 보장
-- 세대별 자기부담률 차이: 1세대 100%, 2/3세대 80%, 4세대 70%
-- ============================================================

-- AS824 발목 골절 외래 의원 (급여만, 비급여 없음)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-12-01', '튼튼정형외과의원', '정형외과', '(양방)발목 및 발 부분의 골절', 'AS824', '외래', 31000, 44200, 13200, 0, 'UNCLAIMED', NOW(), NOW());

-- AS824 발목 골절 수술 입원 3일 (급여+비급여 혼합, 입원 케이스)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-12-05', '서울성모병원', '정형외과', '(양방)발목 및 발 부분의 골절-수술적 치료', 'AS824', '입원', 820000, 1170000, 350000, 85000, 'UNCLAIMED', NOW(), NOW());

-- AS622 손목 골절 외래 병원 (비급여 포함 - 깁스·재료대)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-11-20', '강남성심병원', '정형외과', '(양방)손목 및 손 부분의 골절', 'AS622', '외래', 42000, 60000, 18000, 35000, 'UNCLAIMED', NOW(), NOW());

-- AS400 어깨 타박상 외래 의원 (급여만)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-10-01', '튼튼정형외과의원', '정형외과', '(양방)어깨 및 위팔의 타박상', 'AS400', '외래', 14500, 20700, 6200, 0, 'UNCLAIMED', NOW(), NOW());

-- AS836 무릎 인대 손상 외래 병원 (비급여 도수치료 포함 - 3세대 특약 필요)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-09-10', '강남성심병원', '정형외과', '(양방)무릎의 내측 측부인대 염좌 및 긴장', 'AS836', '외래', 35000, 50000, 15000, 120000, 'UNCLAIMED', NOW(), NOW());

-- AS824 요양병원 재활 입원 (골절 후 장기 재활, 비급여 포함)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-07-01', '강남요양병원', '재활의학과', '(양방)발목 골절 후 재활치료', 'AS824', '입원', 380000, 542000, 162000, 95000, 'UNCLAIMED', NOW(), NOW());

-- ============================================================
-- 비급여 집중 케이스 - 세대별 보장 한도 차이 테스트
-- 1세대: 비급여 100% / 2세대: 80% / 3세대: 도수특약시 80% / 4세대: 70%+연한도
-- ============================================================

-- M545 도수치료 외래 의원 (비급여 전액 - 3세대 특약, 4세대 연한도 적용)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-11-05', '강남재활의학과의원', '재활의학과', '(양방)하요부통', 'M545', '외래', 0, 0, 0, 150000, 'UNCLAIMED', NOW(), NOW());

-- AS824 MRI 검사 (상해 후 비급여 - 3/4세대 MRI특약 필요)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-12-02', '강남성심병원', '정형외과', '(양방)발목 및 발 부분의 골절-MRI 검사', 'AS824', '외래', 0, 0, 0, 480000, 'UNCLAIMED', NOW(), NOW());

-- M751 비급여 관절 내 주사 (프롤로테라피 - 세대별 보장 다름)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-10-20', '강남재활의학과의원', '재활의학과', '(양방)어깨의 병변', 'M751', '외래', 8000, 11400, 3400, 80000, 'UNCLAIMED', NOW(), NOW());

-- ============================================================
-- 내과 만성질환 - 통원 급여 중심 케이스
-- ============================================================

-- I10 고혈압 외래 의원 (만성질환 관리, 급여)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-12-10', '서울내과의원', '내과', '(양방)본태성(원발성) 고혈압', 'I10', '외래', 9800, 14000, 4200, 0, 'UNCLAIMED', NOW(), NOW());

-- E119 당뇨 외래 의원 (만성질환 관리, 급여)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-11-25', '서울내과의원', '내과', '(양방)인슐린-비의존 당뇨병', 'E119', '외래', 12300, 17600, 5300, 0, 'UNCLAIMED', NOW(), NOW());

-- J069 급성 감기 외래 의원 (급여)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-10-05', '서울내과의원', '내과', '(양방)급성 상기도 감염', 'J069', '외래', 8100, 11600, 3500, 0, 'UNCLAIMED', NOW(), NOW());

-- $ 약국 조제약 (감기, 약제비 외래)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-10-05', '서울약국', '일반의', '해당없음', '$', '외래', 8400, 12000, 3600, 0, 'UNCLAIMED', NOW(), NOW());

-- J189 폐렴 외래 병원 (급여+비급여 혼합, 종합병원급)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-09-15', '강남성심병원', '내과', '(양방)상세불명의 병원체에 의한 폐렴', 'J189', '외래', 45200, 64500, 19300, 12000, 'UNCLAIMED', NOW(), NOW());

-- J300 알레르기 비염 외래 의원 (급여)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-08-20', '서울이비인후과의원', '이비인후과', '(양방)혈관운동성 비염', 'J300', '외래', 7200, 10300, 3100, 0, 'UNCLAIMED', NOW(), NOW());

-- AT212 화상 외래 의원 (상해, 급여)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-07-30', '서울내과의원', '내과', '(양방)몸통의 2도 화상', 'AT212', '외래', 38000, 54300, 16300, 0, 'UNCLAIMED', NOW(), NOW());

-- L309 피부염 외래 피부과 (급여+비급여 연고)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-08-15', '서울피부과의원', '피부과', '(양방)상세불명의 피부염', 'L309', '외래', 9800, 14000, 4200, 15000, 'UNCLAIMED', NOW(), NOW());

-- ============================================================
-- 수술/입원 케이스
-- ============================================================

-- K37 맹장염 수술 입원 (COMPLETED - 이미 청구 완료)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-08-10', '서울성모병원', '외과', '(양방)기타 맹장염', 'K37', '입원', 1250000, 1785000, 535000, 320000, 'COMPLETED', NOW(), NOW());

-- K802 담낭결석 복강경수술 입원 (비급여 선택진료비 포함, UNCLAIMED)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-06-20', '강남성심병원', '외과', '(양방)급성 담낭염을 동반한 담낭 결석', 'K802', '입원', 1680000, 2400000, 720000, 580000, 'UNCLAIMED', NOW(), NOW());

-- ============================================================
-- 암 관련 (정액 담보 + 실손 이중 보장 테스트)
-- CLAIMED/COMPLETED claim_status 테스트
-- ============================================================

-- C169 위암 최초 진단 종합병원 외래 (CLAIMED - 보험금 청구 진행 중)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2025-05-01', '삼성서울병원', '종양내과', '(양방)위의 악성 신생물-최초진단', 'C169', '외래', 185000, 264000, 79000, 45000, 'CLAIMED', NOW(), NOW());

-- C73 갑상선암 수술 입원 (COMPLETED - 정액+실손 청구 완료)
INSERT INTO medical_records (user_id, visit_date, hospital, department, diagnosis, disease_code, treatment_details, medical_cost, insurance_coverage, out_of_pocket, non_covered_amount, claim_status, created_at, updated_at)
VALUES (2, '2024-09-15', '삼성서울병원', '외과', '(양방)갑상선의 악성 신생물', 'C73', '입원', 2100000, 3000000, 900000, 420000, 'COMPLETED', NOW(), NOW());

-- ── 약 처방 (medication_details) ──────────────────────────
-- 발목 골절 소염진통제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '세레콕시브캡슐200밀리그램(세레콕시브)', '1캡슐', '1일 2회', '7일', '2025-12-01', '2025-12-07', '발목 골절 통증', NOW(), NOW());

-- 발목 골절 수술 후 항생제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '맥시크란정625밀리그람(아목시실린-클라불란산칼륨)', '1정', '1일 3회', '5일', '2025-12-05', '2025-12-09', '수술 후 감염 예방', NOW(), NOW());

-- 발목 골절 수술 후 진통제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '써스펜8시간이알서방정650밀리그램(아세트아미노펜)', '1정', '1일 3회', '5일', '2025-12-05', '2025-12-09', '수술 후 통증', NOW(), NOW());

-- 무릎 인대 손상 소염제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '대웅바이오록소프로펜정(록소프로펜나트륨수화물)_(68.1mg/1정)', '1정', '1일 3회', '5일', '2025-09-10', '2025-09-14', '무릎 인대 손상 통증', NOW(), NOW());

-- 고혈압약 (장기 복용 30일)
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '아모잘탄정5/50밀리그램(암로디핀베실산염/로사르탄칼륨)', '1정', '1일 1회', '30일', '2025-12-10', '2026-01-08', '본태성 고혈압', NOW(), NOW());

-- 당뇨약 (장기 복용 30일)
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '메트포르민염산염서방정500밀리그램', '1정', '1일 2회', '30일', '2025-11-25', '2025-12-24', '인슐린-비의존 당뇨병', NOW(), NOW());

-- 감기약 (소염진통제)
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '슈다페드정60밀리그램(슈도에페드린염산염)', '1정', '1일 3회', '5일', '2025-10-05', '2025-10-09', '급성 상기도 감염', NOW(), NOW());

-- 맹장염 수술 후 항생제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '세포탁심나트륨주사제(세포탁심나트륨)', '1g', '1일 2회', '3일', '2025-08-10', '2025-08-12', '수술 후 감염 예방', NOW(), NOW());

-- 맹장염 수술 후 진통제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '케토로락트로메타민주사(케토로락트로메타민)', '30mg', '1일 3회', '2일', '2025-08-10', '2025-08-11', '수술 후 통증', NOW(), NOW());

-- 위암 항암제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '젤로다정500밀리그램(카페시타빈)', '2정', '1일 2회', '14일', '2025-05-01', '2025-05-14', '위암 항암화학요법', NOW(), NOW());

-- 갑상선 수술 후 호르몬제 (장기 복용)
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '씬지로이드정100mcg(레보티록신나트륨)', '1정', '1일 1회', '90일', '2024-09-20', '2024-12-18', '갑상선 수술 후 호르몬 보충', NOW(), NOW());

-- 알레르기 비염 항히스타민제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '알레그라정60밀리그램(펙소페나딘염산염)', '1정', '1일 2회', '14일', '2025-08-20', '2025-09-02', '혈관운동성 비염', NOW(), NOW());

-- 치주농양 항생제
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '아목시실린캡슐500밀리그램(아목시실린)', '1캡슐', '1일 3회', '5일', '2025-09-20', '2025-09-24', '치주농양', NOW(), NOW());

-- 화상 항생연고
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '베아로반연고(무피로신)_(0.2g/10g)', '적량', '1일 1회', '7일', '2025-07-30', '2025-08-05', '2도 화상 처치', NOW(), NOW());

-- 리도카인 마취주사 (치과 처치용)
INSERT INTO medication_details (user_id, medication_name, dosage, frequency, duration, prescribed_date, end_date, indication, created_at, updated_at)
VALUES (2, '휴온스리도카인염산염수화물-에피네프린주(1:100,000)_(1.8mL)', '1앰플', '1일 1회', '1일', '2025-10-15', '2025-10-15', '치수염 처치 국소마취', NOW(), NOW());

COMMIT;
