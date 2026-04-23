FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY insurance-service/build.gradle insurance-service/
COPY insurance-service/src insurance-service/src/
RUN sed -i 's/\r$//' gradlew && chmod +x ./gradlew
RUN ./gradlew :insurance-service:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/insurance-service/build/libs/*.jar app.jar
EXPOSE 8003
ENTRYPOINT ["java", "-jar", "app.jar"]
