#!/usr/bin/env bash
# ==============================================================================
# Script: CloudCluster All-Service Initial Authentication & Credentials Provisioner
# 作用: 初始安装前统一生成/配置所有 8 大服务的强密码与认证凭证 (拒绝空密码匿名访问)
# 产物: 
#   1. credentials.env (供 Shell / Docker 环境加载)
#   2. helm/custom-credentials.yaml (供 Helm 部署覆盖默认密码)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
CREDENTIALS_FILE="${PROJECT_ROOT}/credentials.env"
HELM_CREDENTIALS_FILE="${PROJECT_ROOT}/helm/custom-credentials.yaml"

# 随机 16 位强密码生成函数
generate_password() {
  LC_ALL=C tr -dc 'A-Za-z0-9#%*+=' < /dev/urandom | head -c 16 || openssl rand -base64 12 | tr -d '/+' | head -c 16
}

echo "======================================================================"
echo " CloudCluster 初始安装强密码与认证凭证生成器"
echo "======================================================================"

GENERATE_NEW=false
if [ "${1:-}" == "--generate" ] || [ ! -f "${CREDENTIALS_FILE}" ]; then
  GENERATE_NEW=true
fi

if [ "${GENERATE_NEW}" = true ]; then
  echo "正在自动生成高强度随机密码 (16位)..."

  MINIO_ROOT_USER="minioAdmin"
  MINIO_ROOT_PASSWORD="$(generate_password)"

  MYSQL_ROOT_PASSWORD="$(generate_password)"
  MYSQL_APP_USER="app_user"
  MYSQL_APP_PASSWORD="$(generate_password)"
  MYSQL_REPL_PASSWORD="$(generate_password)"

  MONGO_ROOT_USER="admin"
  MONGO_ROOT_PASSWORD="$(generate_password)"
  MONGO_APP_USER="mongo_app"
  MONGO_APP_PASSWORD="$(generate_password)"
  MONGO_KEYFILE_BASE64="$(openssl rand -base64 32 | tr -d '\n')"

  REDIS_PASSWORD="$(generate_password)"

  KAFKA_ADMIN_USER="admin"
  KAFKA_ADMIN_PASSWORD="$(generate_password)"
  KAFKA_CLIENT_USER="app_user"
  KAFKA_CLIENT_PASSWORD="$(generate_password)"

  ZK_ADMIN_USER="zkAdmin"
  ZK_ADMIN_PASSWORD="$(generate_password)"

  FLINK_ADMIN_USER="flinkAdmin"
  FLINK_ADMIN_PASSWORD="$(generate_password)"

  K8S_JOIN_TOKEN="abcdef.$(openssl rand -hex 8)"

  # 写入 credentials.env
  cat <<EOF > "${CREDENTIALS_FILE}"
# CloudCluster Cluster Initial Credentials (Auto-Generated: $(date))
# MinIO S3 Object Storage
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}

# MySQL 8.4 LTS
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
MYSQL_APP_USER=${MYSQL_APP_USER}
MYSQL_APP_PASSWORD=${MYSQL_APP_PASSWORD}
MYSQL_REPL_PASSWORD=${MYSQL_REPL_PASSWORD}

# MongoDB 8.0 ReplicaSet (rs0)
MONGO_ROOT_USER=${MONGO_ROOT_USER}
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
MONGO_APP_USER=${MONGO_APP_USER}
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}
MONGO_KEYFILE_BASE64=${MONGO_KEYFILE_BASE64}

# Redis 6.2 Sentinel
REDIS_PASSWORD=${REDIS_PASSWORD}

# Apache Kafka 3.7 KRaft (SASL_PLAINTEXT)
KAFKA_ADMIN_USER=${KAFKA_ADMIN_USER}
KAFKA_ADMIN_PASSWORD=${KAFKA_ADMIN_PASSWORD}
KAFKA_CLIENT_USER=${KAFKA_CLIENT_USER}
KAFKA_CLIENT_PASSWORD=${KAFKA_CLIENT_PASSWORD}

# ZooKeeper 3.6
ZK_ADMIN_USER=${ZK_ADMIN_USER}
ZK_ADMIN_PASSWORD=${ZK_ADMIN_PASSWORD}

# Apache Flink 1.9 Web Dashboard
FLINK_ADMIN_USER=${FLINK_ADMIN_USER}
FLINK_ADMIN_PASSWORD=${FLINK_ADMIN_PASSWORD}

# Kubernetes Worker Join Token
K8S_JOIN_TOKEN=${K8S_JOIN_TOKEN}
EOF
  echo "✓ 已成功写入环境变量文件: ${CREDENTIALS_FILE}"
else
  echo "正在读取已存在的凭证文件: ${CREDENTIALS_FILE}"
  # shellcheck source=/dev/null
  source "${CREDENTIALS_FILE}"
fi

# 生成 Helm 部署自定义 values 文件
cat <<EOF > "${HELM_CREDENTIALS_FILE}"
# ------------------------------------------------------------------------------
# CloudCluster Custom Initial Credentials (Auto-Generated)
# ------------------------------------------------------------------------------
minio:
  rootUser: "${MINIO_ROOT_USER}"
  rootPassword: "${MINIO_ROOT_PASSWORD}"

mysql:
  rootPassword: "${MYSQL_ROOT_PASSWORD}"
  appUser: "${MYSQL_APP_USER}"
  appPassword: "${MYSQL_APP_PASSWORD}"
  replicationPassword: "${MYSQL_REPL_PASSWORD}"

mongodb:
  auth:
    rootUser: "${MONGO_ROOT_USER}"
    rootPassword: "${MONGO_ROOT_PASSWORD}"
    appUser: "${MONGO_APP_USER}"
    appPassword: "${MONGO_APP_PASSWORD}"
    keyfileBase64: "${MONGO_KEYFILE_BASE64}"

redis:
  password: "${REDIS_PASSWORD}"

kafka:
  auth:
    enabled: true
    adminUser: "${KAFKA_ADMIN_USER}"
    adminPassword: "${KAFKA_ADMIN_PASSWORD}"
    clientUser: "${KAFKA_CLIENT_USER}"
    clientPassword: "${KAFKA_CLIENT_PASSWORD}"

zookeeper:
  auth:
    adminUser: "${ZK_ADMIN_USER}"
    adminPassword: "${ZK_ADMIN_PASSWORD}"

flink:
  auth:
    enabled: true
    adminUser: "${FLINK_ADMIN_USER}"
    adminPassword: "${FLINK_ADMIN_PASSWORD}"
EOF

echo "✓ 已成功同步生成 Helm 自定义凭证: ${HELM_CREDENTIALS_FILE}"
echo ""
echo "======================================================================"
echo " 初始安装账号与密码凭证清单 (强制认证已启用)"
echo "======================================================================"
printf "%-18s | %-16s | %-24s\n" "组件服务" "账号 (Username)" "密码 (Password)"
echo "----------------------------------------------------------------------"
printf "%-18s | %-16s | %-24s\n" "MinIO (9000/9001)" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "MySQL 8.4 Root" "root" "${MYSQL_ROOT_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "MySQL 8.4 App" "${MYSQL_APP_USER}" "${MYSQL_APP_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "MongoDB 8.0 Root" "${MONGO_ROOT_USER}" "${MONGO_ROOT_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "MongoDB 8.0 App" "${MONGO_APP_USER}" "${MONGO_APP_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "Redis 6.2" "default" "${REDIS_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "Kafka Admin" "${KAFKA_ADMIN_USER}" "${KAFKA_ADMIN_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "Kafka Client" "${KAFKA_CLIENT_USER}" "${KAFKA_CLIENT_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "ZooKeeper 3.6" "${ZK_ADMIN_USER}" "${ZK_ADMIN_PASSWORD}"
printf "%-18s | %-16s | %-24s\n" "Flink 1.9 Web" "${FLINK_ADMIN_USER}" "${FLINK_ADMIN_PASSWORD}"
echo "======================================================================"
echo "提示: Helm 安装时可直接使用 ./scripts/helm-install.sh 执行，将自动加载该认证配置！"
