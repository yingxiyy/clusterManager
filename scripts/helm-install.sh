#!/usr/bin/env bash
# ==============================================================================
# Deploy CloudCluster Helm Chart with Custom Values & Extensions
# Usage: ./scripts/helm-install.sh [NAMESPACE] [RELEASE_NAME] [VALUES_OVERRIDE_FILE]
# ==============================================================================
set -euo pipefail

NAMESPACE="${1:-data-platform}"
RELEASE_NAME="${2:-cloudcluster}"
VALUES_FILE="${3:-helm/values.yaml}"

echo "======================================================================"
echo " Deploying CloudCluster Helm Stack"
echo " Namespace: ${NAMESPACE}"
echo " Release:   ${RELEASE_NAME}"
echo " Values:    ${VALUES_FILE}"
echo "======================================================================"

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

helm upgrade --install "${RELEASE_NAME}" ./helm \
  --namespace "${NAMESPACE}" \
  -f "${VALUES_FILE}" \
  --wait \
  --timeout 15m

echo "======================================================================"
echo " Checking Cluster Member Pods:"
echo "======================================================================"
kubectl get pods,svc,statefulsets,pvc -n "${NAMESPACE}" -l app.kubernetes.io/part-of=cloudcluster-stack
