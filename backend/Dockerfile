# One recipe for all 6 services:  docker build --build-arg SERVICE=order-service backend/
# Works on the Oracle Always Free ARM server (arm64) and on normal x86 PCs.

FROM maven:3.9-eclipse-temurin-21 AS build
ARG SERVICE
WORKDIR /src
COPY ${SERVICE}/pom.xml .
COPY ${SERVICE}/src ./src
# The cache mount keeps downloaded libraries between builds, so rebuilds are fast
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests package \
 && cp target/*-SNAPSHOT.jar /app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --no-create-home campusfood  && mkdir -p /data/photos /data/id-photos && chown campusfood /data/photos /data/id-photos
COPY --from=build /app.jar /app/app.jar
USER campusfood
# Kept small so all 6 services + MySQL fit easily on the free server
ENV JAVA_OPTS="-Xms64m -Xmx384m -XX:+UseSerialGC -Duser.timezone=Asia/Kolkata"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
