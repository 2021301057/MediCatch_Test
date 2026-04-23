FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY eureka-server/build.gradle eureka-server/
COPY eureka-server/src eureka-server/src/
RUN sed -i 's/\r$//' gradlew && chmod +x ./gradlew
RUN ./gradlew :eureka-server:bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/eureka-server/build/libs/*.jar app.jar
EXPOSE 8761
ENTRYPOINT ["java", "-jar", "app.jar"]
