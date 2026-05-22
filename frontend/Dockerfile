FROM node:20-alpine AS builder
WORKDIR /app
ARG REACT_APP_API_BASE_URL=http://localhost:8000/api
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
