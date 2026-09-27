# ==============================================================================
# Dockerfile: Apache Kafka with KRaft mode running on Java 1.8 (OpenJDK 8)
# ==============================================================================
FROM eclipse-temurin:8-jre-focal

ENV KAFKA_VERSION=3.7.2 \
    SCALA_VERSION=2.13 \
    KAFKA_HOME=/opt/kafka \
    PATH=$PATH:/opt/kafka/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    tar \
    procps \
    awscli \
    && rm -rf /var/lib/apt/lists/*

# Download Apache Kafka 3.7.2 (KRaft supported, Java 8 runtime compatible)
RUN set -ex; \
    mkdir -p ${KAFKA_HOME}; \
    curl -fsSL "https://archive.apache.org/dist/kafka/${KAFKA_VERSION}/kafka_${SCALA_VERSION}-${KAFKA_VERSION}.tgz" \
      -o /tmp/kafka.tgz; \
    tar -xf /tmp/kafka.tgz -C ${KAFKA_HOME} --strip-components=1; \
    rm /tmp/kafka.tgz

RUN groupadd -r kafka --gid=1001 && \
    useradd -r -g kafka --uid=1001 -d ${KAFKA_HOME} kafka && \
    mkdir -p /var/lib/kafka/data && \
    chown -R kafka:kafka ${KAFKA_HOME} /var/lib/kafka

WORKDIR ${KAFKA_HOME}
USER kafka

EXPOSE 9092 9093 9094
CMD ["kafka-server-start.sh", "/opt/kafka/config/kraft/server.properties"]
