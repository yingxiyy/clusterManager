#!/usr/bin/env bash
# ==============================================================================
# Script: Kubeadm 3-Master HA Initialization & Untaint for Worker Workloads
# ==============================================================================
set -euo pipefail

VIP="${1:-192.168.1.100}"
K8S_VERSION="${2:-1.29.6-1.1}"
INSTALL_DIR="${3:-/opt/kubernetes}"

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

echo "Step 1: Initializing Master 1 via VIP ${VIP}:6443..."
kubeadm init \
  --control-plane-endpoint "${VIP}:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=$(hostname -I | awk '{print $1}')

mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config

echo "Step 2: Installing CNI (Flannel/Calico)..."
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

echo "Step 3: Untaint Master nodes so worker pods (Kafka, Mongo, Flink) can run on them..."
kubectl taint nodes --all node-role.kubernetes.io/control-plane- || true
kubectl taint nodes --all node-role.kubernetes.io/master- || true

echo "Cluster initialized! To join the other 2 masters:"
echo "kubeadm join ${VIP}:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH> --control-plane --certificate-key <CERT_KEY>"
echo ""
echo "To join extension worker nodes:"
echo "kubeadm join ${VIP}:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>"
