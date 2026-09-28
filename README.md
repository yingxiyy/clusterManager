# CloudCluster HA K8s & Stateful Stack (Flink, Kafka KRaft, Mongo, MySQL, Redis, MinIO)

生产级高可用 Kubernetes 集群方案与分布式有状态组件栈（Java 8 兼容 + MinIO S3 统一持久化存储）。

## 核心特性
- **3-Master 高可用**: Keepalived 虚拟 VIP (`192.168.1.100`) + HAProxy 负载均衡 6443。
- **全节点充当 Worker**: 3 台 Master 自动移除污点，均可调度业务 Pod，同时支持随时横向扩展工作节点。
- **Java 1.8 原生兼容**:
  - Apache Flink 1.9.3 (Scala 2.12 + OpenJDK 8)
  - Apache Kafka 3.7.2 (KRaft Raft 模式，保留 Java 8 运行时支持)
  - Apache ZooKeeper 3.6.3 (可选保留)
- **Central MinIO S3 数据湖**:
  - Flink 检查点（Checkpoints / Savepoints）通过 `s3-fs-hadoop` 插件直连 MinIO S3。
  - MySQL 与 MongoDB 定时快照流式推送至 MinIO 桶备份。
- **纯 Docker Hub 官方镜像**: 无需手工构建庞大 Dockerfile，直接拉取 `mongo:8.0.9`, `mysql:8.4.6`, `redis:6.2.6-alpine`, `apache/kafka:3.7.2`, `flink:1.9.3-scala_2.12`。
- **双模弹性伸缩与安全确认窗口**:
  - **Worker 扩展**: Web 界面输入参数，生成安全专用的 CLI 脚本并在物理机/VM 执行。
  - **Pod 扩展 (Flink/Kafka/DB)**: Web 界面确认弹窗后，后端可**直接自动执行**或生成 Helm CLI 命令。
  - **强制确认窗口 (Confirmation Modal)**: 任意节点或组件增删均弹出风险影响提示。

## 详细安装与配置指南
请查阅工程文件：**[`INSTALL.md`](./INSTALL.md)**
- 第 1 节：集群网络与机器规划
- 第 2 节：Master 节点高可用 (Keepalived + HAProxy)
- 第 3 节：初始化 3 台 Master/Worker 节点
- 第 4 节：Worker 节点扩展流程 (物理机/VM 手工执行 CLI)
- 第 5 节：第三方应用集群部署 (Helm + Docker Hub)
- 第 6 节：Pod 与组件弹性伸缩 (后端自动执行 vs CLI)
- 第 7 节：持久化存储与 S3 备份机制

## 快速导航
- 目录结构：
  - `/helm/`: 生产 Helm Chart 与 `values.yaml` 配置
  - `/scripts/k8s-ha-setup/`: Keepalived + HAProxy、Kubeadm 初始化与 Worker 加入脚本
  - `/src/App.tsx`: Web 端集群可视化管理平台、K9s 终端模拟器与伸缩确认弹窗
