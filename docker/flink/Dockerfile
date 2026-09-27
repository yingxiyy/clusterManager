# ==============================================================================
# Dockerfile: Apache Flink 1.9.3 on Java 1.8 (OpenJDK 8) with S3 Plugin
# ==============================================================================
FROM eclipse-temurin:8-jre-focal

ENV FLINK_VERSION=1.9.3 \
    SCALA_VERSION=2.12 \
    FLINK_HOME=/opt/flink \
    PATH=$PATH:/opt/flink/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    tar \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Download and extract Apache Flink 1.9.3
RUN set -ex; \
    mkdir -p ${FLINK_HOME}; \
    curl -fsSL "https://archive.apache.org/dist/flink/flink-${FLINK_VERSION}/flink-${FLINK_VERSION}-bin-scala_${SCALA_VERSION}.tgz" \
      -o /tmp/flink.tgz; \
    tar -xf /tmp/flink.tgz -C ${FLINK_HOME} --strip-components=1; \
    rm /tmp/flink.tgz

# Enable S3 Filesystem Plugin (s3-fs-hadoop) for S3 / MinIO Checkpointing & Savepoints
RUN set -ex; \
    mkdir -p ${FLINK_HOME}/plugins/s3-fs-hadoop; \
    cp ${FLINK_HOME}/opt/flink-s3-fs-hadoop-${FLINK_VERSION}.jar ${FLINK_HOME}/plugins/s3-fs-hadoop/

# Create flink user & permissions
RUN groupadd -r flink --gid=9999 && \
    useradd -r -g flink --uid=9999 -d ${FLINK_HOME} flink && \
    chown -R flink:flink ${FLINK_HOME}

WORKDIR ${FLINK_HOME}
USER flink

EXPOSE 6121 6122 6123 6124 8081
CMD ["bash"]
