FROM node:20-alpine AS builder
WORKDIR /app
# 상대경로 /api 사용 — nginx가 /api/ → gateway-service:8000으로 프록시
ARG REACT_APP_API_BASE_URL=/api
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
# 카카오지도 JavaScript 키 (CRA 환경변수는 빌드 시점에 번들에 포함됨)
ARG REACT_APP_KAKAO_MAP_KEY
ENV REACT_APP_KAKAO_MAP_KEY=$REACT_APP_KAKAO_MAP_KEY
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
