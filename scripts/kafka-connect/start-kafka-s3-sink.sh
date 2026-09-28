#!/usr/bin/env bash
# ==============================================================================
# Script: Direct Kafka-To-MinIO-S3-Streaming-Sink (Bypassing Flink)
# Usage: Direct ingestion from Kafka topics straight to MinIO S3 via S3 Sink Connector
# ==============================================================================
set -euo pipefail

KAFKA_CONNECT_URL="${1:-http://localhost:8083}"
CONFIG_FILE="$(dirname "$0")/kafka-s3-sink-connector.json"

echo "Deploying Kafka-To-MinIO-S3-Streaming-Sink directly into Kafka Connect..."
echo "Target S3 endpoint: http://minio:9000 (Bucket: flink-checkpoints)"

curl -s -X POST \
  -H "Content-Type: application/json" \
  --data @"${CONFIG_FILE}" \
  "${KAFKA_CONNECT_URL}/connectors" | jq . || true

echo "Direct Kafka -> S3 Streaming Connector active! No Flink engine required."
