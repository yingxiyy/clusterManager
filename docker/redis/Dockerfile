# ==============================================================================
# Dockerfile: Redis 6.2.6 with Sentinel & S3 snapshot utilities
# ==============================================================================
FROM redis:6.2.6-alpine

RUN apk add --no-cache \
    bash \
    curl \
    aws-cli

RUN mkdir -p /etc/redis /data && \
    chown -R redis:redis /data

WORKDIR /data
USER redis

EXPOSE 6379 26379
CMD ["redis-server"]
