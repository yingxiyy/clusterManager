# ==============================================================================
# Dockerfile: MySQL 8.4.6 LTS with AWS CLI & Backup Tools for MinIO S3
# ==============================================================================
FROM mysql:8.4.6

RUN microdnf update -y && \
    microdnf install -y \
    awscli \
    gzip \
    tar \
    procps \
    && microdnf clean all

# Custom backup script
COPY <<'EOF' /usr/local/bin/backup-to-s3.sh
#!/bin/bash
set -eo pipefail
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="/tmp/dump_${TIMESTAMP}.sql.gz"

echo "Dumping databases..."
mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" --all-databases --single-transaction --quick | gzip > "${BACKUP_PATH}"

echo "Transferring to MinIO S3..."
aws --endpoint-url="${S3_ENDPOINT}" s3 cp "${BACKUP_PATH}" "s3://${S3_BUCKET}/mysql_${TIMESTAMP}.sql.gz"
rm -f "${BACKUP_PATH}"
echo "Completed."
EOF

RUN chmod +x /usr/local/bin/backup-to-s3.sh

EXPOSE 3306 33060
CMD ["mysqld"]
