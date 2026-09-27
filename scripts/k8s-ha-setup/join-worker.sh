#!/usr/bin/env bash
# ==============================================================================
# Script: Join Extension Worker Node to the HA Cluster
# Usage: ./join-worker.sh <VIP:6443> <TOKEN> <HASH> <INSTALL_DIR>
# ==============================================================================
set -euo pipefail

VIP_ENDPOINT="${1:-192.168.1.100:6443}"
TOKEN="${2}"
CA_HASH="${3}"
INSTALL_DIR="${4:-/opt/kubernetes}"

mkdir -p "${INSTALL_DIR}"
echo "Pre-flight checks on extension worker..."
systemctl enable containerd
systemctl start containerd

echo "Joining worker node to cluster at ${VIP_ENDPOINT}..."
kubeadm join "${VIP_ENDPOINT}" \
  --token "${TOKEN}" \
  --discovery-token-ca-cert-hash "sha256:${CA_HASH}"

echo "Worker node joined successfully!"
