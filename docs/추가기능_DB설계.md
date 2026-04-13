# MediCatch 추가 기능 DB 설계

> 기존 PDF 기획안의 DB 스키마에 추가되는 테이블

---

## 신규 1: Chat Service 스키마 (프로젝트_chat)

### chat_history (건강 채팅 이력)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| chat_id | BIGINT | 채팅 메시지 ID |
| user_id | BIGINT | 사용자 ID |
| role | ENUM('USER','ASSISTANT') | 발화자 구분 |
| message | TEXT | 메시지 내용 |
| context_json | JSON | AI 답변 생성 시 사용된 사용자 컨텍스트 |
| intent_type | VARCHAR(50) | 질문 유형 (COVERAGE_CHECK, CLAIM_GUIDE 등) |
| created_at | DATETIME | 생성 일시 |

```sql
CREATE TABLE chat_history (
    chat_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id      BIGINT NOT NULL,
    role         ENUM('USER', 'ASSISTANT') NOT NULL,
    message      TEXT NOT NULL,
    context_json JSON,
    intent_type  VARCHAR(50),
    created_at   DATETIME DEFAULT NOW(),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
```

---

## 신규 2: Analysis Service 추가 테이블 (프로젝트_analysis)

### pre_treatment_searches (진료 전 검색 이력)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| search_id | BIGINT | 검색 ID |
| user_id | BIGINT | 사용자 ID |
| keyword | VARCHAR(100) | 검색 키워드 (도수치료, MRI 등) |
| treatment_code | VARCHAR(20) | 매핑된 치료 코드 |
| searched_at | DATETIME | 검색 일시 |

```sql
CREATE TABLE pre_treatment_searches (
    search_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id        BIGINT NOT NULL,
    keyword        VARCHAR(100) NOT NULL,
    treatment_code VARCHAR(20),
    searched_at    DATETIME DEFAULT NOW()
);
```

### health_reports (건강 통합 리포트 캐시)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| report_id | BIGINT | 리포트 ID |
| user_id | BIGINT | 사용자 ID |
| report_period | CHAR(6) | 기준 연월 (202504) |
| report_json | JSON | 리포트 전체 데이터 (캐시) |
| generated_at | DATETIME | 생성 일시 |

```sql
CREATE TABLE health_reports (
    report_id     BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id       BIGINT NOT NULL,
    report_period CHAR(6) NOT NULL,
    report_json   JSON NOT NULL,
    generated_at  DATETIME DEFAULT NOW(),
    UNIQUE KEY uk_user_period (user_id, report_period)
);
```

---

## 기존 테이블 확인 (추가 작업 불필요)

아래 기능들은 기존 PDF 기획안의 DB 스키마로 충분히 커버됩니다:

| 기능 | 사용 테이블 |
|------|------------|
| 건강 검진 기록 | `checkup_results`, `disease_predictions` (기존) |
| 내 보험 조회 | `policies`, `coverage_items`, `policy_premiums` (기존) |
| 진료 기록 & 청구 | `medical_records`, `medication_details`, `claim_opportunities` (기존) |
| 보험 추천 & 공백 | `coverage_gap_reports`, `insurance_recommendations` (기존) |
