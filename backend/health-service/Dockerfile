FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY health-service/build.gradle health-service/
COPY health-service/src health-service/src/
RUN sed -i 's/\r$//' gradlew && chmod +x ./gradlew
RUN ./gradlew :health-service:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/health-service/build/libs/*.jar app.jar
EXPOSE 8002
ENTRYPOINT ["java", "-jar", "app.jar"]
