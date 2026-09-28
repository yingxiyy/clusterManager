#!/usr/bin/env bash
# ==============================================================================
# Script: Install k9s CLI terminal dashboard on Linux
# ==============================================================================
set -euo pipefail

K9S_VERSION="${1:-v0.32.4}"
ARCH="$(uname -m)"

case "${ARCH}" in
  x86_64) K9S_ARCH="amd64" ;;
  aarch64|arm64) K9S_ARCH="arm64" ;;
  *) echo "Unsupported architecture: ${ARCH}"; exit 1 ;;
esac

echo "===> Downloading k9s ${K9S_VERSION} for Linux ${K9S_ARCH}..."
TMP_DIR="$(mktemp -d)"
TAR_URL="https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_${K9S_ARCH}.tar.gz"

curl -sS -L "${TAR_URL}" | tar -xz -C "${TMP_DIR}"

mv "${TMP_DIR}/k9s" /usr/local/bin/k9s
chmod +x /usr/local/bin/k9s
rm -rf "${TMP_DIR}"

echo "------------------------------------------------------------------"
echo "✅ k9s installed successfully to /usr/local/bin/k9s"
k9s version --short || k9s version
echo ""
echo "Usage:"
echo "  k9s                       # Open interactive cluster monitor"
echo "  k9s -n data-platform      # Monitor data-platform namespace directly"
echo "  k9s --all-namespaces      # Monitor all namespaces"
echo "------------------------------------------------------------------"
