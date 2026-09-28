#!/usr/bin/env bash
# ==============================================================================
# Script: HAProxy & Keepalived Multi-Master HA Setup for 3 Master Nodes
# Target: 3 K8s Masters (Virtual IP + Load Balanced 6443)
# ==============================================================================
set -euo pipefail

VIP="${1:-192.168.1.100}"
PARAM_INTERFACE="${2:-auto}"
MASTER1_IP="${3:-192.168.1.101}"
MASTER2_IP="${4:-192.168.1.102}"
MASTER3_IP="${5:-192.168.1.103}"

# ------------------------------------------------------------------------------
# 问：INTERFACE 是 3 台机器都一样吗？
# 答：不一定一样！物理机或不同虚拟机上网卡名字可能不同（如 eth0, ens192, bond0）。
# 如果传入 "auto" 或留空，脚本会自动探测本机默认路由的主网卡。
# ------------------------------------------------------------------------------
if [ "${PARAM_INTERFACE}" = "auto" ] || [ -z "${PARAM_INTERFACE}" ]; then
  DETECTED_IFACE=$(ip route show default 2>/dev/null | awk '{print $5}' | head -n 1 || true)
  if [ -z "${DETECTED_IFACE}" ]; then
    # Fallback if no default route
    DETECTED_IFACE=$(ip -o link show | awk -F': ' '{print $2}' | grep -v 'lo' | head -n 1)
  fi
  INTERFACE="${DETECTED_IFACE}"
  echo "==> Auto-detected local network interface for this machine: [${INTERFACE}]"
else
  INTERFACE="${PARAM_INTERFACE}"
  echo "==> Using user-specified interface: [${INTERFACE}]"
fi

if [ -z "${INTERFACE}" ]; then
  echo "ERROR: Could not detect valid network interface! Please specify manually (e.g. eth0)."
  exit 1
fi

echo "Configuring HAProxy and Keepalived for VIP ${VIP} on local interface ${INTERFACE}..."

# 1. Install HAProxy & Keepalived
apt-get update && apt-get install -y keepalived haproxy

# 2. Configure HAProxy load balancing for kube-apiserver
cat <<EOF > /etc/haproxy/haproxy.cfg
global
    log /dev/log local0
    log /dev/log local1 notice
    daemon

defaults
    log     global
    mode    tcp
    option  tcplog
    option  dontlognull
    retries 3
    timeout connect 5000ms
    timeout client  50000ms
    timeout server  50000ms

frontend k8s-apiserver
    bind ${VIP}:6443
    mode tcp
    option tcplog
    default_backend k8s-apiserver-backend

backend k8s-apiserver-backend
    mode tcp
    option tcp-check
    balance roundrobin
    default-server inter 10s downinter 5s rise 2 fall 3 check check-ssl verify none
    server master-01 ${MASTER1_IP}:6443 check
    server master-02 ${MASTER2_IP}:6443 check
    server master-03 ${MASTER3_IP}:6443 check
EOF

# 3. Configure Keepalived VIP
cat <<EOF > /etc/keepalived/keepalived.conf
vrrp_script check_haproxy {
    script "killall -0 haproxy"
    interval 2
    weight 2
}

vrrp_instance VI_1 {
    state BACKUP
    interface ${INTERFACE}
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass K8sHaSecretPass
    }
    virtual_ipaddress {
        ${VIP}
    }
    track_script {
        check_haproxy
    }
}
EOF

# Enable kernel IP binding for non-local VIP
cat <<EOF > /etc/sysctl.d/99-k8s-vip.conf
net.ipv4.ip_nonlocal_bind = 1
EOF
sysctl --system > /dev/null 2>&1 || true

systemctl enable haproxy keepalived
systemctl restart haproxy keepalived
echo "HAProxy & Keepalived successfully started on ${INTERFACE}!"
