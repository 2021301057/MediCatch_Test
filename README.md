# 🏥 MediCatch

> **내 건강 데이터로 찾는, 나에게 딱 맞는 보험**  
> CODEF API 기반 건강보험 분석 & AI 어시스턴트 플랫폼

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React 18, React Router v6, Zustand, Recharts, Axios |
| API Gateway | Spring Cloud Gateway (JWT 인증, 라우팅) |
| Backend MSA | Spring Boot 4.x (Java 21), Spring Cloud Eureka |
| AI 채팅 | OpenAI GPT-4o (Chat Completions API) |
| 메시지 | Apache Kafka, RabbitMQ |
| Database | MySQL 8.0 |
| Cache | Redis |
| CI/CD | GitHub Actions + Jenkins + Docker Hub |
| 외부 API | CODEF 헬스케어 패키지 + CODEF 보험사 API |

---

## 서비스 구조

```
medicatch/
├── frontend/              # React 웹 앱 (포트 3000)
├── backend/
│   ├── gateway-service/   # API Gateway (포트 8000)
│   ├── eureka-server/     # 서비스 디스커버리 (포트 8761)
│   ├── user-service/      # 인증/회원 (포트 8001)
│   ├── health-service/    # 건강 데이터 (포트 8002)
│   ├── insurance-service/ # 보험 조회 (포트 8003)
│   ├── analysis-service/  # 분석 엔진 (포트 8004)
│   └── chat-service/      # AI 채팅 (포트 8007)
├── docker-compose.yml
└── .env.example
```

---

## 7가지 핵심 기능

| # | 기능 | 설명 |
|---|------|------|
| 1 | 🔍 진료 전 검색 | "도수치료 보험 돼?" — 치료 전 보장 여부 확인 |
| 2 | 🏥 건강 검진 기록 | CODEF 연동 건강검진 결과 + 질환 위험도 |
| 3 | 🛡️ 내 보험 조회 | 다보험사 통합 조회 + 보장 항목 상세 |
| 4 | 📋 진료 기록 & 청구 | 자동 수집 + 청구 가능 보험금 탐지 |
| 5 | 📊 보험 추천 & 공백 | 건강 위험도 기반 맞춤 보험 추천 |
| 6 | 📈 건강 통합 리포트 | 최근 12개월 의료 이용 패턴 분석 |
| 7 | 💬 건강 AI 채팅 | GPT-4o 기반 건강·보험 AI 어시스턴트 |

---

## 빠른 시작

### 1. 환경변수 설정
```bash
cp .env.example .env
# .env 파일에 CODEF API 키, OpenAI API 키 입력
```

### 2. Docker로 전체 실행
```bash
docker-compose up -d
# 브라우저: http://localhost:3000
```

### 3. 개발 환경 (로컬)

**Backend (각 서비스)**
```bash
cd backend/user-service
./gradlew bootRun

cd backend/chat-service
./gradlew bootRun
```

**Frontend**
```bash
cd frontend
npm install
npm start
```

---

## 브랜치 전략

```
main   ← 배포 (Jenkins 자동 빌드)
  └─ dev  ← 개발 통합
       ├─ feature/기능명
       └─ fix/버그명
```

## 커밋 메시지 규칙

| 접두사 | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `fix:` | 버그 수정 |
| `docs:` | 문서 |
| `refactor:` | 리팩토링 |
| `chore:` | 설정/패키지 |
| `test:` | 테스트 |

---

## 팀

| 이름 | 역할 |
|------|------|
| 강은주 윤현식| Frontend / 기획 |
| 강은주 윤현식 | Backend / CODEF 연동 |

**협력사**: 헥토데이터 멀티플랫폼개발팀  
**개발 기간**: 2026년 4월 ~ 6월
