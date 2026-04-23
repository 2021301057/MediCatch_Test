FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY chat-service/build.gradle chat-service/
COPY chat-service/src chat-service/src/
RUN sed -i 's/\r$//' gradlew && chmod +x ./gradlew
RUN ./gradlew :chat-service:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/chat-service/build/libs/*.jar app.jar
EXPOSE 8007
ENTRYPOINT ["java", "-jar", "app.jar"]
