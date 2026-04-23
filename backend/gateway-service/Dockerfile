FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY gateway-service/build.gradle gateway-service/
COPY gateway-service/src gateway-service/src/
RUN sed -i 's/\r$//' gradlew && chmod +x ./gradlew
ENV GRADLE_OPTS="-Dorg.gradle.daemon=false \
  -Dorg.gradle.internal.http.connectionTimeout=120000 \
  -Dorg.gradle.internal.http.socketTimeout=120000"
RUN for i in 1 2 3; do \
      ./gradlew :gateway-service:bootJar -x test --no-daemon && break; \
      echo "Retry $i/3 in 20s..."; sleep 20; \
    done

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/gateway-service/build/libs/*.jar app.jar
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "app.jar"]
