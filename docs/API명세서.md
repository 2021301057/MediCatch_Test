# MediCatch API 명세서

## Base URL
- 개발: `http://localhost:8080/api`
- 운영: `https://api.medicatch.com/api`

## 인증
모든 API는 Header에 JWT 토큰 필요
```
Authorization: Bearer {token}
```

## Endpoints

### 인증
| Method | URL | 설명 |
|--------|-----|------|
| POST | /auth/signup | 회원가입 |
| POST | /auth/login | 로그인 |
| POST | /auth/refresh | 토큰 갱신 |

### CODEF 연동
| Method | URL | 설명 |
|--------|-----|------|
| POST | /codef/connect | CODEF 계정 연결 |
| GET | /codef/insurance | 보험 목록 조회 |
| GET | /codef/medical-records | 진료 기록 조회 |

### 분석
| Method | URL | 설명 |
|--------|-----|------|
| POST | /analysis/claim | 청구 가능 여부 분석 |
| GET | /analysis/coverage | 보장 분석 |
