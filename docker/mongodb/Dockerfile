# ==============================================================================
# Dockerfile: MongoDB 8.0.9 on Ubuntu 22.04 with Mongo-Tools & AWS CLI for S3
# Target: mongodb-linux-x86_64-ubuntu2204-8.0.9
# ==============================================================================
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    MONGO_VERSION=8.0.9 \
    TOOLS_VERSION=100.10.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    tar \
    gzip \
    procps \
    libcurl4 \
    openssl \
    libssl3 \
    awscli \
    && rm -rf /var/lib/apt/lists/*

# Install MongoDB 8.0.9 and MongoDB Database Tools
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
    tee /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    apt-get update && apt-get install -y --no-install-recommends \
    mongodb-org-server=8.0.9 \
    mongodb-org-tools \
    mongodb-mongosh \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/db /data/keyfile /data/configdb && \
    chown -R 999:999 /data

VOLUME /data/db
EXPOSE 27017

USER 999
CMD ["mongod", "--bind_ip_all"]
