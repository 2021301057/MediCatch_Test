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

-- 케이스4: KB손보 2세대 실손 (활성, 도수치료 등 비급여 특약 있음)
INSERT INTO policies (user_id, codef_id, policy_number, insurer_name, insurance_type, start_date, end_date, is_active, monthly_premium, premium_amount, payment_cycle, payment_period, has_supplementary_coverage, policy_details, created_at, updated_at)
VALUES (2, 'test', 'KB-2017-00345678', 'KB손해보험', 'SUPPLEMENTARY', '2017-04-01', '2037-04-01', TRUE, 45000, 45000, '월납', '전기납', TRUE, 'KB 실손의료보험(2세대, 비급여특약 포함)', NOW(), NOW());

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

COMMIT;
