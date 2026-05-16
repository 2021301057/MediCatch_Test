# MediCatch 작업 규칙

## 필수 규칙 — 반드시 지킬 것

1. **푸시 전 반드시 사용자 확인을 받는다.**
   - `git push` 실행 전에 항상 먼저 물어본다.
   - 사용자가 명시적으로 "푸시해줘" 또는 "어. 푸시해봐" 등으로 승인한 경우에만 푸시한다.

2. **정보가 필요하면 반드시 질문한다.**
   - 확실하지 않은 부분이 있으면 추측하지 말고 사용자에게 먼저 물어본다.

## 개발 환경

- 브랜치: `test`
- 백엔드(analysis-service): 포트 `8005`
- 테스트 curl 형식:
  ```
  curl -X POST http://localhost:8005/api/analysis/pre-treatment-search -H "Content-Type: application/json" -d "{\"query\": \"검색어\"}"
  ```
