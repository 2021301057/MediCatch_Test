# MediCatch Backend - Microservices Architecture

Korean health insurance analysis platform using Spring Boot microservices with CODEF API integration.

## Services Overview

### 1. Eureka Server (Port 8761)
- Service discovery and registration
- Central registry for all microservices

### 2. Gateway Service (Port 8000)
- API Gateway with Spring Cloud Gateway
- JWT authentication filter
- Request routing to microservices
- Centralized entry point

### 3. User Service (Port 8001)
- User registration and authentication
- JWT token generation (access: 15min, refresh: 7days)
- CODEF connection management
- User profile management

### 4. Health Service (Port 8003)
- Medical records management
- Checkup results tracking
- Medication history
- Health risk assessment
- CODEF health data integration

### 5. Insurance Service (Port 8004)
- Insurance policy management
- Coverage details and benefits
- Coverage gap analysis
- Claim opportunity detection
- Insurance cost estimation

### 6. Chat Service (Port 8002) - AI Feature
- OpenAI GPT-4o integration
- Korean language support
- Chat history with context
- Intent detection (insurance, health, claims, etc.)
- Contextual system prompts with user health/insurance data

### 7. Analysis Service (Port 8005)
- Pre-treatment search with cost estimation
- Hospital search with coverage information
- Coverage gap identification
- Claim opportunity finder
- Potential savings calculation

## Project Structure

```
backend/
├── eureka-server/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/eureka/
│   └── src/main/resources/application.yml
├── gateway-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/gateway/
│   │   ├── GatewayServiceApplication.java
│   │   └── filter/JwtAuthenticationFilter.java
│   └── src/main/resources/application.yml
├── user-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/user/
│   │   ├── UserServiceApplication.java
│   │   ├── entity/ (User.java, CodefConnection.java)
│   │   ├── dto/ (SignupRequest, LoginRequest, AuthResponse, UserProfileResponse)
│   │   ├── repository/ (UserRepository, CodefConnectionRepository)
│   │   ├── service/ (AuthService, CodefService)
│   │   ├── controller/ (AuthController)
│   │   └── config/ (SecurityConfig, JwtTokenProvider, JwtAuthenticationFilter)
│   └── src/main/resources/application.yml
├── health-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/health/
│   │   ├── HealthServiceApplication.java
│   │   ├── entity/ (MedicalRecord, CheckupResult, MedicationDetail)
│   │   ├── repository/ (MedicalRecordRepository, CheckupResultRepository, MedicationDetailRepository)
│   │   ├── service/ (HealthService, CodefHealthService)
│   │   └── controller/ (HealthController)
│   └── src/main/resources/application.yml
├── insurance-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/insurance/
│   │   ├── InsuranceServiceApplication.java
│   │   ├── entity/ (Policy, CoverageItem)
│   │   ├── repository/ (PolicyRepository, CoverageItemRepository)
│   │   ├── service/ (InsuranceService)
│   │   └── controller/ (InsuranceController)
│   └── src/main/resources/application.yml
├── chat-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/chat/
│   │   ├── ChatServiceApplication.java
│   │   ├── entity/ (ChatHistory)
│   │   ├── dto/ (ChatRequest, ChatResponse, ChatHistoryDto)
│   │   ├── repository/ (ChatHistoryRepository)
│   │   ├── client/ (OpenAiClient)
│   │   ├── service/ (ChatService)
│   │   └── controller/ (ChatController)
│   └── src/main/resources/application.yml
├── analysis-service/
│   ├── build.gradle
│   ├── src/main/java/com/medicatch/analysis/
│   │   ├── AnalysisServiceApplication.java
│   │   ├── service/ (PreTreatmentSearchService, CoverageGapService)
│   │   └── controller/ (AnalysisController)
│   └── src/main/resources/application.yml
└── init.sql
```

## Database Setup

```bash
mysql -u root -p < init.sql
```

Creates databases:
- medicatch_user
- medicatch_health
- medicatch_insurance
- medicatch_analysis
- medicatch_chat

## Building and Running

### Prerequisites
- Java 21+
- MySQL 8.0+
- Gradle 7.6+
- OpenAI API key (for chat service)

### Build All Services
```bash
# From backend directory
gradle clean build -x test
```

### Run Services (in order)
```bash
# Terminal 1: Eureka Server
cd eureka-server
gradle bootRun

# Terminal 2: Gateway Service
cd gateway-service
gradle bootRun

# Terminal 3: User Service
cd user-service
gradle bootRun

# Terminal 4: Health Service
cd health-service
gradle bootRun

# Terminal 5: Insurance Service
cd insurance-service
gradle bootRun

# Terminal 6: Chat Service
cd chat-service
OPENAI_API_KEY=sk-your-key gradle bootRun

# Terminal 7: Analysis Service
cd analysis-service
gradle bootRun
```

## API Endpoints

### Authentication (User Service)
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile

### Health (Health Service)
- `GET /api/health/summary?userId=1` - Health summary
- `GET /api/health/medical-records?userId=1` - Medical history
- `GET /api/health/checkup-results?userId=1` - Checkup results
- `GET /api/health/medications?userId=1` - Current medications
- `GET /api/health/risk-level?userId=1` - Health risk assessment

### Insurance (Insurance Service)
- `GET /api/insurance/policies?userId=1` - Active policies
- `GET /api/insurance/policies/{id}/coverage` - Coverage items
- `GET /api/insurance/coverage/check` - Check specific coverage
- `GET /api/insurance/coverage/estimate` - Estimate coverage amount
- `GET /api/insurance/summary?userId=1` - Insurance summary

### Chat (Chat Service)
- `POST /api/chat/message` - Send message and get AI response
- `GET /api/chat/history?userId=1` - Get chat history
- `DELETE /api/chat/history?userId=1` - Clear chat history

### Analysis (Analysis Service)
- `GET /api/analysis/treatments/search?condition=당뇨병` - Search treatments
- `GET /api/analysis/conditions` - Get available conditions
- `GET /api/analysis/hospitals/search?condition=당뇨병` - Search hospitals
- `GET /api/analysis/coverage-gaps?userId=1` - Analyze coverage gaps
- `GET /api/analysis/claim-opportunities?userId=1` - Find claim opportunities
- `GET /api/analysis/savings-analysis?userId=1` - Calculate potential savings

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-your-openai-api-key
CODEF_CLIENT_ID=your-codef-client-id
CODEF_CLIENT_SECRET=your-codef-client-secret
CODEF_RSA_PUBLIC_KEY=your-rsa-public-key
```

### Database
Default credentials in application.yml:
- Username: root
- Password: medicatch_password
- Host: localhost:3306

## Key Features

### 1. JWT Authentication
- Access tokens: 15 minutes
- Refresh tokens: 7 days
- Stateless session management
- Gateway-level validation

### 2. AI Chat Integration
- GPT-4o model for intelligent responses
- Korean language support
- Context-aware system prompts
- Intent detection
- Health and insurance information integration
- Chat history tracking

### 3. CODEF API Integration
- OAuth2 authentication
- RSA-2048 encryption for credentials
- Health data synchronization
- Secure credential storage

### 4. Microservices Communication
- Eureka service discovery
- Spring Cloud Gateway
- Feign clients for inter-service communication
- Actuator health checks

### 5. Data Security
- Password hashing with BCrypt
- AES encryption for CODEF credentials
- JWT for API authentication
- HTTPS ready

## Testing

```bash
# Test user signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "passwordConfirm": "Password123!",
    "name": "Test User",
    "birthDate": "1990-01-01",
    "gender": "M"
  }'

# Test user login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'

# Test health summary
curl -X GET "http://localhost:8000/api/health/summary?userId=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test chat message
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": 1,
    "message": "당뇨병 검사의 보험 보장이 어떻게 되나요?"
  }'
```

## Technology Stack

- **Framework**: Spring Boot 3.2.0
- **Language**: Java 21
- **Build Tool**: Gradle 7.6+
- **Database**: MySQL 8.0+
- **Message Queue**: Redis (optional)
- **API Gateway**: Spring Cloud Gateway
- **Service Discovery**: Eureka
- **Authentication**: JWT (JJWT)
- **AI Integration**: OpenAI GPT-4o
- **CODEF Integration**: OkHttp3
- **Encryption**: Bouncy Castle (RSA)

## Notes

- All services register with Eureka automatically
- Gateway routes all API requests through JWT validation
- Chat service requires valid OpenAI API key
- Database migration handled by Hibernate DDL auto-update
- Comprehensive error handling and logging in all services

## Future Enhancements

1. Redis caching for chat history and user context
2. Message queues for async operations
3. Service-to-service authentication (mTLS)
4. Advanced analytics dashboard
5. Mobile app integration
6. Real-time notifications
7. Audit logging
8. Rate limiting
