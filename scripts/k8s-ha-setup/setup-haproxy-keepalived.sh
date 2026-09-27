#!/usr/bin/env bash
# ==============================================================================
# Script: HAProxy & Keepalived Multi-Master HA Setup for 3 Master Nodes
# Target: 3 K8s Masters (Virtual IP + Load Balanced 6443)
# ==============================================================================
set -euo pipefail

VIP="${1:-192.168.1.100}"
INTERFACE="${2:-eth0}"
MASTER1_IP="${3:-192.168.1.101}"
MASTER2_IP="${4:-192.168.1.102}"
MASTER3_IP="${5:-192.168.1.103}"

echo "Configuring HAProxy and Keepalived for VIP ${VIP} on interface ${INTERFACE}..."

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
    server master-01 ${MASTER1_IP}:6443
    server master-02 ${MASTER2_IP}:6443
    server master-03 ${MASTER3_IP}:6443
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

systemctl enable haproxy keepalived
systemctl restart haproxy keepalived
echo "HAProxy & Keepalived successfully configured!"
