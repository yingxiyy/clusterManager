# ==============================================================================
# Dockerfile: Apache ZooKeeper 3.6.3 on Java 1.8 (OpenJDK 8)
# ==============================================================================
FROM eclipse-temurin:8-jre-focal

ENV ZK_VERSION=3.6.3 \
    ZK_HOME=/opt/zookeeper \
    PATH=$PATH:/opt/zookeeper/bin

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    tar \
    procps \
    && rm -rf /var/lib/apt/lists/*

RUN set -ex; \
    mkdir -p ${ZK_HOME} /data /datalog; \
    curl -fsSL "https://archive.apache.org/dist/zookeeper/zookeeper-${ZK_VERSION}/apache-zookeeper-${ZK_VERSION}-bin.tar.gz" \
      -o /tmp/zookeeper.tgz; \
    tar -xf /tmp/zookeeper.tgz -C ${ZK_HOME} --strip-components=1; \
    rm /tmp/zookeeper.tgz

RUN groupadd -r zookeeper --gid=1002 && \
    useradd -r -g zookeeper --uid=1002 -d ${ZK_HOME} zookeeper && \
    chown -R zookeeper:zookeeper ${ZK_HOME} /data /datalog

WORKDIR ${ZK_HOME}
USER zookeeper

EXPOSE 2181 2888 3888
CMD ["zkServer.sh", "start-foreground"]
