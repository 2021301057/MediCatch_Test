FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY analysis-service/build.gradle analysis-service/
COPY analysis-service/src analysis-service/src/
RUN chmod +x ./gradlew
RUN ./gradlew :analysis-service:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/analysis-service/build/libs/*.jar app.jar
EXPOSE 8004
ENTRYPOINT ["java", "-jar", "app.jar"]
