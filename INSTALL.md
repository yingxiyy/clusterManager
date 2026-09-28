# CloudCluster Kubernetes HA & Stateful Stack 部署与运维手册

本项目提供了在 **3台物理机/虚拟机** 上搭建高可用 Kubernetes 集群（Keepalived VIP + HAProxy），并以集群模式部署第三方组件的完整工程方案。

---

## 目录
1. [集群网络与机器规划](#1-集群网络与机器规划)
2. [节点环境初始化与 Kubernetes (k8s) & k9s 安装](#2-节点环境初始化与-kubernetes-k8s--k9s-安装)
3. [Master 节点高可用 (Keepalived + HAProxy)](#3-master-节点高可用-keepalived--haproxy)
4. [初始化 3 台 Master/Worker 节点 (kubeadm init & join)](#4-初始化-3-台-masterworker-节点)
5. [Worker 节点扩展流程 (物理机/VM 手工执行 CLI)](#5-worker-节点扩展流程)
6. [第三方应用集群部署 (Helm + Docker Hub)](#6-第三方应用集群部署)
7. [Pod 与组件弹性伸缩 (后端自动执行 vs CLI)](#7-pod-与组件弹性伸缩)
8. [持久化存储与 S3 备份机制](#8-持久化存储与-s3-备份机制)

---

## 1. 集群网络与机器规划

| 主机名 | IP 地址 | 角色 | 说明 |
| :--- | :--- | :--- | :--- |
| **VIP (虚拟IP)** | `192.168.1.100` | 控制面高可用入口 | Keepalived 漂移 VIP，HAProxy 监听 6443 |
| **k8s-master-01** | `192.168.1.101` | Master 1 + Worker | 运行 etcd、kube-apiserver，同时调度业务 Pod |
| **k8s-master-02** | `192.168.1.102` | Master 2 + Worker | 运行 etcd、kube-apiserver，同时调度业务 Pod |
| **k8s-master-03** | `192.168.1.103` | Master 3 + Worker | 运行 etcd、kube-apiserver，同时调度业务 Pod |
| **k8s-worker-04+**| `192.168.1.104+`| 扩展 Worker | 纯 Worker 节点，弹性扩容 |

> **关键机制**：默认 Kubernetes 会在 Master 上打污点（Taint）。我们在初始化完成后会执行 `kubectl taint nodes --all node-role.kubernetes.io/control-plane-`，使得 **3 台 Master 机器同时充当 Worker 节点**，充分利用 3 台机器的 CPU、内存和磁盘。

---

## 2. 节点环境初始化与 Kubernetes (k8s) & k9s 安装

> **适用范围**：在所有 3 台 Master 机器与后续所有扩展 Worker 物理机/虚拟机上均需执行本节环境初始化与组件安装。

### 方式 A：一键自动化脚本（推荐）
本项目已将系统调优、容器运行时与 Kubernetes 组件封装为自动化脚本，直接在目标机器执行：
```bash
chmod +x ./scripts/k8s-ha-setup/*.sh

# 1. 一键安装 containerd、kubeadm、kubelet、kubectl 并完成内核/Swap优化
sudo ./scripts/k8s-ha-setup/install-k8s-prerequisites.sh v1.29

# 2. 一键安装 k9s 终端图形化管理工具
sudo ./scripts/k8s-ha-setup/install-k9s.sh v0.32.4
```

---

### 方式 B：手动分步安装与原理解析

#### 步骤 2.1：操作系统优化与永久关闭 Swap
Kubernetes 要求节点必须关闭 Swap 分区，以确保 Pod 内存调度的精确与稳定性：
```bash
# 临时关闭 swap
sudo swapoff -a

# 永久关闭 swap（注释 /etc/fstab 中的 swap 挂载行）
sudo sed -ri '/\sswap\s/s/^#?/#/' /etc/fstab
```

#### 步骤 2.2：加载内核模块与开启网络桥接与转发
加载 `overlay` 和 `br_netfilter` 模块，并配置 sysctl 允许 iptables 检查网桥流量：
```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

#### 步骤 2.3：安装与配置容器运行时 (containerd)
Kubernetes 默认采用 CRI 标准的 `containerd`，并需配置 systemd 作为 cgroup 驱动：
```bash
# Ubuntu / Debian 环境：
sudo apt-get update && sudo apt-get install -y containerd

# CentOS / RHEL 环境：
# sudo yum install -y containerd

# 生成默认配置并启用 SystemdCgroup
sudo mkdir -p /etc/containerd
sudo containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml

# 重启并开机自启 containerd
sudo systemctl daemon-reload
sudo systemctl enable --now containerd
sudo systemctl restart containerd
```

#### 步骤 2.4：安装 Kubernetes 核心组件 (kubelet, kubeadm, kubectl)
从官方源安装对应版本的 Kubernetes 工具包（以 `v1.29` 为例）：
```bash
# Ubuntu 22.04 / Debian 环境：
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
sudo systemctl enable --now kubelet

# CentOS / RHEL 环境：
# cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
# [kubernetes]
# name=Kubernetes
# baseurl=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/
# enabled=1
# gpgcheck=1
# gpgkey=https://pkgs.k8s.io/core:/stable:/v1.29/rpm/repodata/repomd.xml.key
# EOF
# sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes
# sudo systemctl enable --now kubelet
```

#### 步骤 2.5：安装与使用 K9s 终端图形化管理面板
K9s 是 Kubernetes 运维工程师最喜爱的终端全屏监控看板，无需繁琐的 `kubectl` 敲命令，即可图形化查看 Pod、资源消耗、实时日志并一键进入容器：
```bash
# 下载官方二进制安装包并解压至 /usr/local/bin
curl -sS -L https://github.com/derailed/k9s/releases/download/v0.32.4/k9s_Linux_amd64.tar.gz | sudo tar -xz -C /usr/local/bin k9s
sudo chmod +x /usr/local/bin/k9s

# 验证安装
k9s version
```

**K9s 快速操作命令与常用快捷键**：
* 启动终端看板：
  ```bash
  k9s -n data-platform      # 直接进入并实时监控 data-platform 业务组件
  ```
* 核心操作热键：
  * `:pods`：查看当前命名空间的所有 Pod 状态、CPU、内存实时消耗；
  * `l`：实时查看选中 Pod 的日志（Follow logs，类似 `tail -f`）；
  * `d`：执行 describe 查看详细事件（Events）与排错；
  * `s`：直接打开 Shell 进入选中的容器终端；
  * `:ns`：快速切换命名空间。

---

## 3. Master 节点高可用 (Keepalived + HAProxy)

### 关于网卡名称 (`INTERFACE`) 的疑问解答：
> **问：`./k8s-ha-setup.sh <VIP> <INTERFACE> ...` 中，INTERFACE 是 3 台机器都一样吗？**  
> **答：不一定一样！**  
> - 如果是相同规格的云主机（如 CentOS 统一叫 `eth0`，Ubuntu 统一叫 `ens3`），网卡名可能相同。
> - 如果是不同物理机或不同虚拟机（如有的机器是 `ens192`，有的是 `enp3s0`，有的是 `bond0`），网卡名各不相同。
> - **解决方案**：脚本已升级为**自动探测本机默认网卡**。如果你不确定，可传 `auto`，脚本会自动通过 `ip route get 8.8.8.8` 识别本机的有效网卡。

### 执行步骤（3台 Master 分别执行）：

在每台 Master 机器上执行：
```bash
chmod +x ./scripts/k8s-ha-setup/*.sh

# 参数说明: <VIP> <本机网卡名|auto> <MASTER1_IP> <MASTER2_IP> <MASTER3_IP>
sudo ./scripts/k8s-ha-setup/setup-haproxy-keepalived.sh 192.168.1.100 auto 192.168.1.101 192.168.1.102 192.168.1.103
```

检查 VIP 是否成功绑定（应在 Master 1 上看到 VIP）：
```bash
ip addr show | grep 192.168.1.100
systemctl status haproxy keepalived
```

> **接入终端模式支持 (VIP 或 域名)**：
> 1. **虚拟 IP 模式 (Virtual IP)**：例如 `192.168.1.100`，由 Keepalived VRRP 协议负责在 3 台 Master 之间做故障漂移。
> 2. **域名 FQDN 模式**：例如 `k8s-vip.internal.cloud`，由内网 DNS 或各节点 `/etc/hosts` 指向负载均衡器或 Master 节点，Kubeadm 自动将域名写入证书 SAN。
> 3. **后期动态修改**：在 Web 界面随时输入新 IP 或域名，点击【保存修改】后弹出安全确认窗口，确认后后端将**自动更新所有 8 个关联配置文件**并**自动重启 Keepalived、HAProxy、Kubelet 与 API Server**。

---

## 3. 初始化 3 台 Master/Worker 节点

### 步骤 3.1：在 Master 1 (`192.168.1.101`) 初始化控制面
```bash
sudo ./scripts/k8s-ha-setup/init-masters.sh 192.168.1.100
```
该脚本将自动完成：
1. 传入 `--control-plane-endpoint "192.168.1.100:6443"` 并调用 `kubeadm init`。
2. 拷贝 `/etc/kubernetes/admin.conf` 到 `$HOME/.kube/config`。
3. 安装 Flannel CNI 网络插件。
4. **移除 Master 污点**，允许业务 Pod 在 Master 1 上运行。

输出中会包含两条 Join 命令：
- **Master 加入命令**（带 `--control-plane` 与 `--certificate-key`）。
- **Worker 加入命令**（普通 Token）。

### 步骤 3.2：将 Master 2 与 Master 3 加入控制面
在 `192.168.1.102` 与 `192.168.1.103` 上分别执行 Master 加入命令：
```bash
sudo kubeadm join 192.168.1.100:6443 \
  --token <YOUR_TOKEN> \
  --discovery-token-ca-cert-hash sha256:<YOUR_HASH> \
  --control-plane --certificate-key <YOUR_CERT_KEY>
```

加入后，在 Master 1 上验证 3 节点状态：
```bash
kubectl get nodes -o wide
```
应该看到 3 台机器状态均为 `Ready`。

---

## 4. Worker 节点扩展流程 (物理机/VM 手工执行 CLI)

因为 Worker 节点可能是新采购的物理服务器或新开的虚拟机，**必须在目标机器上人工/终端执行**。

### Web 界面操作：
1. 打开 Web 控制台：**"3-Master HA & Worker Nodes"** 标签页。
2. 在 **"Extend Cluster: Add New Worker Node"** 表单输入：
   - Worker 主机名（如 `k8s-worker-04`）
   - IP 地址（如 `192.168.1.104`）
   - 安装目录（默认 `/opt/kubernetes`）
3. 点击 **"Generate Worker Join CLI"**，弹出安全确认窗口。
4. 确认后，Web 界面将直接生成该主机的**专用初始化与加入命令**。

### 在新 Worker 物理机/VM 上执行：
登录新机器（`192.168.1.104`），直接粘贴运行：
```bash
# 1. 确保安装 containerd 与 kubeadm
sudo apt-get update && sudo apt-get install -y containerd kubeadm kubectl

# 2. 加入集群
sudo kubeadm join 192.168.1.100:6443 \
  --token <YOUR_TOKEN> \
  --discovery-token-ca-cert-hash sha256:<YOUR_HASH>
```

在 Master 上验证：
```bash
kubectl get nodes
```

---

## 5. 第三方应用集群部署 (Helm + Docker Hub)

本项目已将所有第三方组件镜像直接对接 **Global Docker Hub 官方镜像**，无需自行在本地构建 Dockerfile 即可启动：

- **MongoDB**: `mongo:8.0.9` (分片集群模式 Sharded Cluster: 2 Mongos 路由器 + 3 节点 ConfigServer CSRS + 2 分片 Shard0/Shard1 × 3 节点高可用)
- **Flink**: `flink:1.9.3-scala_2.12` (Java 8, 1 JobManager + N TaskManagers, 专职处理实时事件流计算，无需参与数据库副本复制)
- **Kafka**: `apache/kafka:3.7.2` (KRaft 模式, Java 8 兼容, 3 节点 Raft 仲裁, 直连 MinIO S3 做数据归档)
- **ZooKeeper**: `zookeeper:3.6.3` (Java 8, 3 节点仲裁集群, client: 2181, peer: 2888, leader: 3888)
- **MySQL**: `mysql:8.4.6` (3 节点 GTID 主从复制)
- **Redis**: `redis:6.2.6-alpine` (3 节点 + Sentinel 仲裁)
- **MinIO**: `minio/minio:RELEASE.2024-04-18T19-09-19Z` (分布式 S3 存储)

### Kafka 直连 MinIO S3 (无需经过 Flink)
数据流直写 S3 配置位于 `/scripts/kafka-connect/kafka-s3-sink-connector.json`，通过 Kafka Connect S3 Sink 直接拉取 Kafka 主题流式写入 MinIO S3 (`s3://flink-checkpoints/`)，极大精简系统链路，不占用 Flink 计算槽位。
执行命令启动：
```bash
./scripts/kafka-connect/start-kafka-s3-sink.sh http://localhost:8083
```

### 一键部署命令：
```bash
helm upgrade --install cloudcluster ./helm \
  --namespace data-platform \
  --create-namespace \
  -f ./helm/values.yaml
```

---

## 6. Pod 与组件弹性伸缩 (后端自动执行 vs CLI)

针对 Pod 级别组件（如 Flink TaskManager、Kafka 节点、Mongo 副本数）：

### 方式 A：Web 控制台后端直接执行
在 Web 界面的 **"Cluster & Flink Extension Center"** 中：
1. 点击 Flink TaskManager `+` 增加节点或 `-` 减少节点。
2. 弹出**强制安全确认窗口 (Confirmation Modal)**，展示：
   - 目标组件名称与当前 Pod 数量。
   - 槽位变化与任务受影响分析（如 Task Slots 从 12 变 20）。
   - 仲裁安全警告。
3. 点击 **"Confirm"** 后，Web 后端 API (`POST /api/k8s/scale`) 将**直接调用底层 Kubernetes 执行伸缩**，无需手动敲命令！

### 方式 B：终端手动 CLI 执行
```bash
# 伸缩 Flink TaskManagers 至 8 节点
helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set flink.taskManager.replicas=8

# 伸缩 Kafka KRaft 节点至 5 节点
helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set kafka.replicas=5
```

---

## 7. 持久化存储与 S3 备份机制

- **Persistent Volume (PVC)**: MongoDB (`/data/db`)、MySQL (`/var/lib/mysql`)、Kafka (`/var/lib/kafka/data`) 均通过 Kubernetes `volumeClaimTemplates` 绑定独立磁盘。
- **容器重启不丢失数据**：Pod 重建或故障恢复时，自动重新挂载原物理卷，绝不写在 Docker 镜像的易失层上。
- **MinIO S3 数据备份**：
  - Flink 状态与 Checkpoints 自动写入 `s3://flink-checkpoints/`。
  - 定时 CronJob 自动将 MySQL (`mysqldump`) 与 MongoDB (`mongodump`) 归档推送到 MinIO S3 桶。
