#!/usr/bin/env bash
# ==============================================================================
# Build and Push Docker Images for CloudCluster Stack
# Usage: ./scripts/build-and-push.sh <REGISTRY> (e.g., docker.io/myorg or localhost:5000)
# ==============================================================================
set -euo pipefail

REGISTRY="${1:-myregistry.internal}"

echo "======================================================================"
echo " Building Multi-Service Images for Registry: ${REGISTRY}"
echo "======================================================================"

# 1. MongoDB 8.0.9 + Mongo Tools (Ubuntu 22.04)
echo "--> Building MongoDB 8.0.9 (Ubuntu 22.04)..."
docker build -t "${REGISTRY}/mongodb:8.0.9-ubuntu2204" -f docker/mongodb/Dockerfile docker/mongodb
docker push "${REGISTRY}/mongodb:8.0.9-ubuntu2204"

# 2. Apache Flink 1.9.3 (Java 8 + S3 plugins)
echo "--> Building Apache Flink 1.9.3 (Java 8)..."
docker build -t "${REGISTRY}/flink:1.9.3-java8" -f docker/flink/Dockerfile docker/flink
docker push "${REGISTRY}/flink:1.9.3-java8"

# 3. MySQL 8.4.6 LTS (S3 backup tools)
echo "--> Building MySQL 8.4.6..."
docker build -t "${REGISTRY}/mysql:8.4.6" -f docker/mysql/Dockerfile docker/mysql
docker push "${REGISTRY}/mysql:8.4.6"

# 4. Redis 6.2.6 (Sentinel enabled)
echo "--> Building Redis 6.2.6..."
docker build -t "${REGISTRY}/redis:6.2.6" -f docker/redis/Dockerfile docker/redis
docker push "${REGISTRY}/redis:6.2.6"

# 5. Apache Kafka 3.7.2 (KRaft mode + Java 8)
echo "--> Building Kafka KRaft (Java 8)..."
docker build -t "${REGISTRY}/kafka:3.7.2-java8" -f docker/kafka-kraft/Dockerfile docker/kafka-kraft
docker push "${REGISTRY}/kafka:3.7.2-java8"

# 6. Apache ZooKeeper 3.6.3 (Java 8)
echo "--> Building ZooKeeper 3.6.3 (Java 8)..."
docker build -t "${REGISTRY}/zookeeper:3.6.3-java8" -f docker/zookeeper/Dockerfile docker/zookeeper
docker push "${REGISTRY}/zookeeper:3.6.3-java8"

echo "======================================================================"
echo " All Docker images built and pushed successfully!"
echo "======================================================================"
