# MediCatch Backend - Quick Start Guide

## 5-Minute Setup

### Prerequisites
- Java 21+ installed
- MySQL 8.0+ running
- OpenAI API key (for chat feature)

### Step 1: Initialize Database (2 minutes)
```bash
cd backend
mysql -u root -p < init.sql
```

### Step 2: Start Eureka Server (1 minute)
```bash
cd eureka-server
gradle bootRun
# Visit http://localhost:8761 to verify
```

### Step 3: Start Gateway (1 minute)
```bash
cd ../gateway-service
gradle bootRun
# Gateway is now listening on port 8000
```

### Step 4: Start Other Services (in separate terminals)

**User Service** (port 8001):
```bash
cd ../user-service
gradle bootRun
```

**Health Service** (port 8003):
```bash
cd ../health-service
gradle bootRun
```

**Insurance Service** (port 8004):
```bash
cd ../insurance-service
gradle bootRun
```

**Chat Service** (port 8002) - with API key:
```bash
cd ../chat-service
export OPENAI_API_KEY=sk-your-api-key-here
gradle bootRun
```

**Analysis Service** (port 8005):
```bash
cd ../analysis-service
gradle bootRun
```

---

## Quick Test

### 1. Register User
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@12345",
    "passwordConfirm": "Test@12345",
    "name": "Test User",
    "birthDate": "1990-01-01",
    "gender": "M"
  }'
```

Expected response includes `accessToken` and `refreshToken`.

### 2. Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@12345"
  }'
```

Save the `accessToken` for next steps.

### 3. Get Health Summary
```bash
curl -X GET "http://localhost:8000/api/health/summary?userId=1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Test AI Chat (Most Important!)
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userId": 1,
    "message": "당뇨병 검사의 보험 보장이 어떻게 되나요?"
  }'
```

AI responds with contextual Korean healthcare information!

### 5. Get Insurance Policies
```bash
curl -X GET "http://localhost:8000/api/insurance/policies?userId=1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6. Search Treatments
```bash
curl -X GET "http://localhost:8000/api/analysis/treatments/search?condition=당뇨병" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Verify Services Are Running

Visit these URLs in your browser or use curl:

| Service | URL | Expected |
|---------|-----|----------|
| Eureka | http://localhost:8761 | Service dashboard |
| Gateway | http://localhost:8000/api/auth/health | `{"status":"UP"}` |
| User Service | http://localhost:8001/api/auth/health | `{"status":"UP"}` |
| Health Service | http://localhost:8003/api/health/health | `{"status":"UP"}` |
| Insurance | http://localhost:8004/api/insurance/health | `{"status":"UP"}` |
| Chat | http://localhost:8002/api/chat/health | `{"status":"UP"}` |
| Analysis | http://localhost:8005/api/analysis/health | `{"status":"UP"}` |

---

## Access Eureka Dashboard

All services auto-register with Eureka. View them at:
**http://localhost:8761/**

You should see all 6 services (excluding Eureka itself) listed as "UP".

---

## Key API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token (use refreshToken)
- `GET /api/auth/profile` - Get user profile

### Health Data
- `GET /api/health/summary?userId=1` - Health overview
- `GET /api/health/medical-records?userId=1` - Medical history
- `GET /api/health/checkup-results?userId=1` - Checkups
- `GET /api/health/risk-level?userId=1` - Health risk

### Insurance
- `GET /api/insurance/policies?userId=1` - Your policies
- `GET /api/insurance/policies/1/coverage` - Coverage details
- `GET /api/insurance/summary?userId=1` - Insurance overview

### AI Chat
- `POST /api/chat/message` - Send message & get AI response
- `GET /api/chat/history?userId=1` - Chat history
- `DELETE /api/chat/history?userId=1` - Clear history

### Analysis
- `GET /api/analysis/treatments/search?condition=당뇨병` - Search treatments
- `GET /api/analysis/conditions` - Available conditions
- `GET /api/analysis/hospitals/search?condition=당뇨병` - Find hospitals
- `GET /api/analysis/coverage-gaps?userId=1` - Gap analysis
- `GET /api/analysis/claim-opportunities?userId=1` - Claim opportunities

---

## Common Issues & Solutions

### Issue: "Connection refused" to MySQL
**Solution**: Ensure MySQL is running
```bash
mysql -u root -p -e "SELECT 1"
```

### Issue: Gradle build fails
**Solution**: Clear cache and rebuild
```bash
gradle clean build -x test
```

### Issue: Port already in use
**Solution**: Kill process or change port in `application.yml`
```bash
lsof -ti:8000 | xargs kill -9
```

### Issue: OpenAI API returns 401
**Solution**: Verify API key is set correctly
```bash
echo $OPENAI_API_KEY
```

### Issue: Eureka shows "DOWN" status
**Solution**: Wait 30 seconds and refresh. Initial registration takes time.

---

## Project Structure

```
backend/
├── eureka-server/               # Service Registry
├── gateway-service/             # API Gateway
├── user-service/                # Authentication
├── health-service/              # Medical Data
├── insurance-service/           # Policies & Coverage
├── chat-service/                # AI Chat (GPT-4o)
├── analysis-service/            # Analysis & Search
├── init.sql                     # Database Setup
├── README.md                    # Full Documentation
└── QUICK_START.md              # This File
```

---

## Next Steps

1. ✅ Review `README.md` for full API documentation
2. ✅ Check `BACKEND_SUMMARY.md` for feature overview
3. ✅ See `init.sql` for database schema
4. ✅ Test all endpoints using the examples above
5. ✅ Integrate with your frontend application

---

## Support

For detailed information:
- **Architecture & APIs**: See `README.md`
- **Feature Summary**: See `BACKEND_SUMMARY.md`
- **File Organization**: See `FILES_CREATED.md`
- **Project Status**: See `IMPLEMENTATION_COMPLETE.md`

---

**Status**: All services ready! Begin with Step 1 above.
