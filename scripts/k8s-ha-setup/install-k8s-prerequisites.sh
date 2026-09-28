#!/usr/bin/env bash
# ==============================================================================
# Script: Install Kubernetes Prerequisites (Containerd, Kubeadm, Kubelet, Kubectl)
# Target OS: Ubuntu / Debian / CentOS / RHEL (Run on all Master & Worker nodes)
# ==============================================================================
set -euo pipefail

K8S_VERSION="${1:-v1.29}"
echo "===> [1/5] Disabling swap..."
swapoff -a
sed -ri '/\sswap\s/s/^#?/#/' /etc/fstab

echo "===> [2/5] Configuring kernel modules and sysctl..."
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sysctl --system

echo "===> [3/5] Installing Container Runtime (containerd)..."
if command -v apt-get &> /dev/null; then
  apt-get update -y
  apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
  apt-get install -y containerd
elif command -v yum &> /dev/null; then
  yum install -y yum-utils device-mapper-persistent-data lvm2
  yum install -y containerd.io || yum install -y containerd
fi

mkdir -p /etc/containerd
containerd config default | tee /etc/containerd/config.toml > /dev/null
# Enable SystemdCgroup for Kubernetes 1.28+
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

systemctl daemon-reload
systemctl enable --now containerd
systemctl restart containerd

echo "===> [4/5] Adding Kubernetes package repository (${K8S_VERSION})..."
if command -v apt-get &> /dev/null; then
  mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://pkgs.k8s.io/core:/stable:/${K8S_VERSION}/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/${K8S_VERSION}/deb/ /" | tee /etc/apt/sources.list.d/kubernetes.list

  apt-get update -y
  apt-get install -y kubelet kubeadm kubectl
  apt-mark hold kubelet kubeadm kubectl
elif command -v yum &> /dev/null; then
  cat <<EOF | tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/${K8S_VERSION}/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/${K8S_VERSION}/rpm/repodata/repomd.xml.key
EOF
  yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
fi

echo "===> [5/5] Enabling Kubelet service..."
systemctl enable --now kubelet

echo "------------------------------------------------------------------"
echo "✅ Kubernetes (${K8S_VERSION}) components & containerd installed successfully!"
echo "Node is ready to initialize master or join as worker."
echo "------------------------------------------------------------------"
