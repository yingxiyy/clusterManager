# CloudCluster Kubernetes HA & Stateful Stack 部署与运维手册

本项目提供了在 **3台物理机/虚拟机** 上搭建高可用 Kubernetes 集群（Keepalived VIP + HAProxy），并以集群模式部署第三方组件的完整工程方案。

---

## 目录
0. [集群所有服务初始安装账号与密码配置清单 (强制认证)](#0-集群所有服务初始安装账号与密码配置清单-强制认证)
1. [集群网络与机器规划](#1-集群网络与机器规划)
2. [节点环境初始化与 Kubernetes (k8s) & k9s 安装](#2-节点环境初始化与-kubernetes-k8s--k9s-安装)
3. [Master 节点高可用 (Keepalived + HAProxy)](#3-master-节点高可用-keepalived--haproxy)
4. [初始化 3 台 Master/Worker 节点 (kubeadm init & join)](#4-初始化-3-台-masterworker-节点)
5. [Worker 节点扩展流程 (物理机/VM 手工执行 CLI)](#5-worker-节点扩展流程)
6. [第三方应用集群部署 (Helm + Docker Hub)](#6-第三方应用集群部署)
7. [后端执行模式配置 (Simulator 模式 vs 真实宿主机执行)](#7-后端执行模式配置-simulator-模式-vs-真实宿主机执行)
8. [3 台物理主机下 MySQL & MongoDB 持久化存储与 S3 冷备份实战](#8-3-台物理主机下-mysql--mongodb-持久化存储与-s3-冷备份实战-方案-3---当前生效标准)

---

## 0. 集群所有服务初始安装账号与密码配置清单 (强制认证)

> **安全准则**：本项目所有 8 大服务均**100% 强制启用用户名/密码或 Token 鉴权**，拒绝任何无密码匿名访问。初始安装前，用户可在 Web 控制台的 `Auth & Initial Credentials (初始认证配置)` 标签页直接审查、一键生成 16 位强密码或导出配置文件。

### 0.1 全组件初始账号与密码总表

| 序号 | 组件名称 | 端口 | 账号类别 | 默认用户名 | 默认密码 | 鉴权协议机制 | 客户端快速连接语法示例 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **MinIO S3** | 9000 (API)<br/>9001 (Web) | 管理员 | `minioAdmin` | `minioAdminPassword123` | AccessKey + SecretKey | `mc alias set myminio http://192.168.1.100:9000 minioAdmin minioAdminPassword123` |
| 2 | **MySQL 8.4** | 3306 | 超级 Root<br/>应用业务<br/>主从同步 | `root`<br/>`app_user`<br/>`repl_user` | `mysqlRootPassword123`<br/>`mysqlAppPassword123`<br/>`replPassword123` | Native Password / GTID 复制 | `mysql -h 192.168.1.100 -P 3306 -u app_user -p'mysqlAppPassword123' appdb` |
| 3 | **MongoDB 8.0** | 27017 | 集群 Root<br/>应用业务<br/>内部节点 | `admin`<br/>`mongo_app`<br/>- | `mongoAdminPassword123`<br/>`mongoAppPassword123`<br/>Keyfile (400 权限) | SCRAM-SHA-256 + Keyfile 副本鉴权 | `mongosh "mongodb://192.168.1.100:27017/appdb?replicaSet=rs0" -u mongo_app -p'mongoAppPassword123' --authenticationDatabase admin` |
| 4 | **Redis 6.2** | 6379 (Cache)<br/>26379 (Sentinel) | 统一密码 | `default` | `redisAuthPassword123` | `requirepass` + `masterauth` | `redis-cli -h 192.168.1.100 -p 6379 -a 'redisAuthPassword123' ping` |
| 5 | **Kafka 3.7** | 9092 | 集群 Admin<br/>业务 Client | `admin`<br/>`app_user` | `kafkaAdminPassword123`<br/>`kafkaAppPassword123` | **SASL_PLAINTEXT** (JAAS PlainLoginModule) | 详见下方 0.3 节 client.properties 配置 |
| 6 | **ZooKeeper 3.6**| 2181 | 节点 Admin | `zkAdmin` | `zkAdminPassword123` | SASL Digest-MD5 / Plain | `zkCli.sh -server 192.168.1.100:2181` 然后执行 `addauth digest zkAdmin:zkAdminPassword123` |
| 7 | **Flink 1.9** | 8081 | 仪表盘 Admin | `flinkAdmin` | `flinkAdminPassword123` | HTTP Basic Authentication | 浏览器直接访问 `http://192.168.1.100:8081` 或 `curl -u flinkAdmin:flinkAdminPassword123 ...` |
| 8 | **Kubernetes** | 6443 | 集群管理 | `kubernetes-admin` | Token: `abcdef.0123456789abcdef` | mTLS 双向证书 + Bearer Token | `kubectl --server=https://192.168.1.100:6443 get nodes` |

---

### 0.2 如何在初始安装前定制修改密码

#### 方式 1：Web 控制台一键定制与导出（最简捷）
1. 访问本系统 Web 控制台顶部导航栏的 **`Auth & Initial Credentials (初始认证配置)`** 标签页；
2. 点击 **`🎲 一键生成强密码`** 按钮，系统会自动为所有 8 大服务生成互不相同的 16 位强密码；
3. 点击 **`📋 复制凭证总表`** 保存到您的密码管理器，或点击 **`💾 导出 credentials.yaml`**；
4. 切换到 `Helm Values Configurator` 标签页，所有修改的账号密码已实时自动更新至部署代码中。

#### 方式 2：修改 `./helm/values.yaml` 文件
在执行 `helm install` 前，直接编辑 `values.yaml`：
```yaml
minio:
  rootUser: "myAdmin"
  rootPassword: "MyCustomStrongPassword123!"

mysql:
  rootPassword: "MyMysqlRootPassword123!"
  appUser: "my_app_user"
  appPassword: "MyAppPassword123!"

mongodb:
  auth:
    rootUser: "admin"
    rootPassword: "MyMongoPassword123!"
    appUser: "my_app_user"
    appPassword: "MyMongoAppPassword123!"

redis:
  password: "MyRedisPassword123!"

kafka:
  auth:
    enabled: true
    adminUser: "admin"
    adminPassword: "MyKafkaAdminPassword123!"
    clientUser: "app_user"
    clientPassword: "MyKafkaClientPassword123!"

flink:
  auth:
    enabled: true
    adminUser: "flinkAdmin"
    adminPassword: "MyFlinkPassword123!"
```

---

### 0.3 客户端认证连接代码配置样例

#### 1. MySQL 8.4 通用应用连接配置：
* **Java Spring Boot (`application.yml`)**：
  ```yaml
  spring:
    datasource:
      url: jdbc:mysql://192.168.1.100:3306/appdb?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
      username: app_user
      password: mysqlAppPassword123
      driver-class-name: com.mysql.cj.jdbc.Driver
  ```
* **Python (SQLAlchemy / PyMySQL)**：
  ```python
  DATABASE_URI = "mysql+pymysql://app_user:mysqlAppPassword123@192.168.1.100:3306/appdb"
  ```
* **Linux 终端直接登录**：
  ```bash
  mysql -h 192.168.1.100 -P 3306 -u app_user -p'mysqlAppPassword123' appdb
  ```

#### 2. MongoDB 8.0 副本集群通用连接配置：
* **标准业务应用（推荐：零侵入、原生直连，无需任何 authSource 参数）**：
  ```yaml
  # Spring Boot application.yml
  spring:
    data:
      mongodb:
        uri: mongodb://mongo_app:mongoAppPassword123@192.168.1.100:27017/appdb?replicaSet=rs0
  ```
* **Python (PyMongo)**：
  ```python
  from pymongo import MongoClient
  client = MongoClient("mongodb://mongo_app:mongoAppPassword123@192.168.1.100:27017/appdb?replicaSet=rs0")
  db = client["appdb"]
  ```
* **跨库多微服务集中认证（如连入其他订单库、用户库）**：
  ```text
  mongodb://mongo_app:mongoAppPassword123@192.168.1.100:27017/<任意目标库>?authSource=admin&replicaSet=rs0
  ```

#### 3. Apache Kafka SASL 客户端配置 (`client.properties`)：
```properties
bootstrap.servers=192.168.1.100:9092
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required \
    username="app_user" \
    password="kafkaAppPassword123";
```

#### 4. Redis 6.2 哨兵与缓存通用连接：
```text
redis://:redisAuthPassword123@192.168.1.100:6379/0
```

---

### 0.4 其他第三方应用程序通用性与深度解答 (FAQ)

#### Q1: 为什么在命令行登录 Mongo 时有时带 `--authenticationDatabase admin`？我的其他应用程序直接连接会报错吗？
* **核心机制解析**：
  MongoDB 的用户并非全局平铺，而是**隶属于特定数据库（Authentication Database）**：
  * **集群 Root 管理员**（如 `admin` 账号）是创建在 `admin` 系统库中的，因此登录 `admin` 管理员账号必须指定认证源为 `admin`（即 `--authenticationDatabase admin` 或 URI 后的 `?authSource=admin`）。
  * **业务应用账号（`mongo_app`）**：在本项目初始化 Job 中，我们为该账号做到了**双向就绪（Dual-Ready）**：
    1. **原生业务库直连**：`mongo_app` 已直接注册在 `appdb` 内部，角色为 `readWrite` + `dbAdmin`。因此，您的任何通用应用程序（Spring Boot、Node.js Mongoose、Python PyMongo、Go）**只需使用最标准、最通用的连接串 `mongodb://mongo_app:pwd@192.168.1.100:27017/appdb?replicaSet=rs0` 即可直接连入，不需要传任何 `--authenticationDatabase` 参数！**
    2. **跨库全局授权**：同时在 `admin` 系统库中也为 `mongo_app` 赋予了 `readWriteAnyDatabase`。如果未来有多个微服务共用该账号访问各自独立的库（如 `order_db`），只需在 URI 附加 `?authSource=admin` 即可读写全集群任意库。

#### Q2: MySQL 的 `app_user` 其他微服务能通用吗？会不会报“Host '10.244.x.x' is not allowed to connect”或权限不足？
* **100% 通用无阻碍**：
  1. **通配主机 `%`**：本项目的 MySQL 初始化脚本自动将 `app_user` 授权为主机通配符 `'app_user'@'%'`，无论是 K8s 内部 Pod（`10.244.x.x`）、宿主机局域网（`192.168.1.x`）还是外部客户端均可自由连接。
  2. **全局多库权限**：自动赋予 `GRANT ALL PRIVILEGES ON *.* TO 'app_user'@'%' WITH GRANT OPTION;`。您的其他应用不仅可以操作默认的 `appdb`，还能自由创建新数据库（`CREATE DATABASE service_b;`）并拥有完全读写管理权限。
  3. **认证协议向下兼容**：MySQL 8.x 默认的 `caching_sha2_password` 会导致很多旧版 Java 驱动、PHP 或 Python 报插件不支持错误。本项目已在 `my.cnf` 与用户创建中统一采用 `mysql_native_password`，保证 100% 的通用兼容性。

#### Q3: 如果我的其他应用程序想要创建完全隔离的独立账号与数据库，怎么操作？
* **MySQL 创建新微服务账号（1行命令）**：
  ```bash
  mysql -h 192.168.1.100 -P 3306 -u root -p'mysqlRootPassword123' -e "
    CREATE DATABASE IF NOT EXISTS order_service;
    CREATE USER 'order_app'@'%' IDENTIFIED WITH mysql_native_password BY 'OrderStrongPass123!';
    GRANT ALL PRIVILEGES ON order_service.* TO 'order_app'@'%';
    FLUSH PRIVILEGES;
  "
  ```
* **MongoDB 创建新微服务独立账号（1行命令）**：
  ```bash
  mongosh "mongodb://192.168.1.100:27017/admin?replicaSet=rs0" -u admin -p'mongoAdminPassword123' --eval "
    db.getSiblingDB('order_service').createUser({
      user: 'order_app',
      pwd: 'OrderStrongPass123!',
      roles: [{ role: 'readWrite', db: 'order_service' }, { role: 'dbAdmin', db: 'order_service' }]
    });
  "
  # 创建后，该微服务即可原生标准直连，无需任何 admin 认证源：
  # mongodb://order_app:OrderStrongPass123!@192.168.1.100:27017/order_service?replicaSet=rs0
  ```

---

### 0.5 统一账号密码体系下：微服务如何知道密码并完成登录？(4 大标准分发姿势)

既然所有微服务共用同一套通用账号密码（如 `mongo_app` / `app_user`），**微服务本身如何“知道”这个密码？**在生产和开发环境中有 4 种标准的优雅分发方式：

#### 姿势 1：Kubernetes 内部微服务 Pod 自动挂载 Secret（云原生最推荐，零密码泄露）
如果你的微服务部署在当前 K8s 集群中，**开发者完全不需要在代码或配置文件里写死密码**！直接在微服务的 Deployment YAML 中引用集群已自动建好的 Secret：
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: data-platform
spec:
  template:
    spec:
      containers:
        - name: app
          image: my-registry/order-service:v1.0
          env:
            # 1. 自动从 Secret 注入 Mongo 密码与用户名
            - name: MONGO_USER
              valueFrom:
                secretKeyRef:
                  name: mongodb-auth
                  key: app-user
            - name: MONGO_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-auth
                  key: app-password
            # 2. 动态拼装通用直连 URI (无需人工记密码)
            - name: SPRING_DATA_MONGODB_URI
              value: "mongodb://$(MONGO_USER):$(MONGO_PASSWORD)@mongodb:27017/appdb?replicaSet=rs0"

            # 3. 自动注入 MySQL 密码与连接串
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-credentials
                  key: app-password
            - name: SPRING_DATASOURCE_URL
              value: "jdbc:mysql://mysql:3306/appdb?useSSL=false&allowPublicKeyRetrieval=true"
            - name: SPRING_DATASOURCE_USERNAME
              value: "app_user"
            - name: SPRING_DATASOURCE_PASSWORD
              value: "$(MYSQL_PASSWORD)"
```
> **优势**：密码由 Kubernetes 负责安全注入，微服务代码中只读取环境变量，后期更改密码只需修改一次 Secret，全集群微服务自动生效！

---

#### 姿势 2：通过微服务配置中心集中分发 (Nacos / Apollo / Spring Cloud Config)
大型微服务项目通常具备配置中心。你只需在配置中心的**公共共享组（如 `common-datasource.yaml`）**里配置一次：
```yaml
# Nacos / Apollo 公共配置: common-datasource.yaml
spring:
  data:
    mongodb:
      uri: mongodb://mongo_app:mongoAppPassword123@192.168.1.100:27017/appdb?replicaSet=rs0
  datasource:
    url: jdbc:mysql://192.168.1.100:3306/appdb?useSSL=false&allowPublicKeyRetrieval=true
    username: app_user
    password: mysqlAppPassword123
```
所有 10~50 个微服务（用户服务、订单服务、支付服务等）启动时默认加载 `common-datasource.yaml`，**任何微服务开发者都不需要单独维护密码，启动即连通**。

---

#### 姿势 3：通过环境变量文件分发 (Docker / Docker Compose / 物理机 VM)
对于运行在独立 Docker 容器或虚拟机上的微服务：
1. 本系统在根目录下已生成标准环境变量文件 `credentials.env`；
2. 启动容器时直接附加 `--env-file` 参数，或在 docker-compose 中引用：
   ```yaml
   services:
     order-service:
       image: order-service:latest
       env_file:
         - credentials.env
   ```
微服务内部直接读取 `process.env.MONGO_APP_PASSWORD` 或 `${MONGO_APP_PASSWORD}`。

---

#### 姿势 4：CI/CD 自动化流水线直接通过 HTTP API 拉取
运维或 CI/CD 构建脚本无需打开网页查看密码，直接请求控制台提供的 API：
```bash
# 获取所有实时密码的 JSON 清单
curl -s http://192.168.1.100:3000/api/credentials

# 提取 Mongo 密码示例:
MONGO_PWD=$(curl -s http://192.168.1.100:3000/api/credentials | grep -o '"MONGO_APP_PASSWORD":"[^"]*' | cut -d'"' -f4)
```

---

### 0.6 Spring Cloud / ZooKeeper 多模块微服务集群对接实战 (以 Gateway + 子服务为例)

针对多模块微服务架构（如带有 `gateway` 作为流量入口、各个子模块通过 `git-commit-id-plugin` 生成构建包并注册到 **ZooKeeper** 的 Spring Cloud / Dubbo 系统），在本项目环境中的标准集成步骤如下：

#### 1. 注册中心连接 (ZooKeeper)
本项目已在 `data-platform` 命名空间中部署了 3 节点高可用 ZooKeeper 集群（端口 `2181`）。
* **集群内微服务连接串**：
  ```properties
  spring.cloud.zookeeper.connect-string=zookeeper:2181
  ```
* **K8s Pod 服务发现关键参数**：
  由于 Pod 之间通过 Calico/Flannel 容器网络互通，微服务注册到 ZooKeeper 时**必须优先使用 Pod IP**，防止被识别为无解析的主机名：
  ```yaml
  spring:
    cloud:
      zookeeper:
        connect-string: zookeeper:2181
        discovery:
          enabled: true
          prefer-ip-address: true # 关键：使用 Pod IP 注册，保证 Gateway 路由能直接连通
          instance-host: ${POD_IP:}
  ```

#### 2. Gateway API 入口网关暴露与路由
`gateway` 作为全平台的外部调用统一入口：
1. **路由到各个子微服务**：利用 Spring Cloud Gateway 动态服务发现，根据服务名做负载均衡：
   ```yaml
   spring:
     cloud:
       gateway:
         discovery:
           locator:
             enabled: true
             lower-case-service-id: true
         routes:
           - id: service-route
             uri: lb://auth-service # 自动从 ZooKeeper 获取各微服务实例列表
             predicates:
               - Path=/api/auth/**
   ```
2. **在 K8s 中通过 NodePort 或 VIP 暴露 Gateway**：
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: microservice-gateway
     namespace: data-platform
   spec:
     type: NodePort
     selector:
       app: gateway
     ports:
       - port: 8080
         targetPort: 8080
         nodePort: 30080 # 外部访问: http://192.168.1.100:30080
   ```

#### 3. 带有 `git-commit-id-plugin` 的微服务打包与 Dockerfile
在 Maven 父工程根目录下，可以单独编译指定子模块：
```bash
# 只编译打包 gateway 模块
mvn clean package -pl gateway -am -DskipTests

# 批量编译打包所有子微服务
mvn clean package -DskipTests
```
通用微服务 Dockerfile 范式：
```dockerfile
FROM eclipse-temurin:21-jre-alpine # Java 21 LTS 官方轻量运行时镜像
WORKDIR /app
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

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

### 1.1 外部 Git (GitHub / GitLab / Gitee) 网络访问与拉取指南

在物理机部署或容器运行过程中，经常需要拉取外部 Git 仓库的代码、Helm Chart 或配置文件。

#### 1. 默认网络连通性
* **物理宿主机**：只要宿主机配置了默认网关（Default Gateway）并开通了外网访问（DNS 8.8.8.8 / 114.114.114.114 可达），即可直接运行 `git clone https://github.com/...`。
* **Kubernetes Pod 内部**：Pod 通过 CNI（Calico/Flannel）提供的 SNAT（源地址转换/IP伪装）借用物理网卡直接出网，同样可以直接访问外部 Git。

#### 2. 测试外网 Git 连通性快速命令
在任意 Master 节点或终端执行以下命令，验证是否能连通外部 Git：
```bash
# 测试 GitHub 连通性 (无需完整 clone，秒级握手探查)
git ls-remote https://github.com/torvalds/linux.git HEAD

# 测试 Gitee 连通性
git ls-remote https://gitee.com/oschina/git-osc.git HEAD
```
如果返回对应分支哈希值（如 `72d3fcf... HEAD`），说明外网 Git 通信 100% 正常。

#### 3. 国内机房访问 GitHub 慢或超时的加速方案
如果在国内物理机网络访问 GitHub 遇到超时，可使用以下主流方案：
* **方案 A：使用 GitHub 镜像加速代理（最简单）**：
  ```bash
  # 在原有 GitHub 地址前添加加速代理前缀:
  git clone https://ghproxy.net/https://github.com/your-org/your-repo.git
  # 或者针对全站 git 配置替换:
  git config --global url."https://ghproxy.net/https://github.com/".insteadOf "https://github.com/"
  ```
* **方案 B：导入国内 Gitee / 腾讯 Coding 镜像**：
  在 Gitee 上一键“从 GitHub 导入仓库”，然后直接克隆 Gitee 地址：
  ```bash
  git clone https://gitee.com/your-name/your-repo.git
  ```
* **方案 C：配置全局 HTTP 代理（如果有企业专线/代理网关）**：
  ```bash
  git config --global http.proxy http://192.168.1.254:7890
  git config --global https.proxy http://192.168.1.254:7890
  ```

#### 4. 访问私有 Git 仓库凭证配置 (Private Repo)
* **方式 1：使用 Personal Access Token (PAT)**：
  ```bash
  git clone https://<your-username>:<your-token>@github.com/your-org/private-repo.git
  ```
* **方式 2：在 Kubernetes 中注入 Git 凭证 Secret（供微服务或 CI/CD Pod 使用）**：
  ```bash
  kubectl create secret generic git-credentials \
    --namespace=data-platform \
    --type=kubernetes.io/basic-auth \
    --from-literal=username='<your-git-user>' \
    --from-literal=password='<your-git-pat-token>'
  ```

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
- **Flink**: `flink:2.0.0-java21` (Java 21 LTS, 1 JobManager + N TaskManagers, 专职处理实时事件流计算，无需参与数据库副本复制)
- **Kafka**: `apache/kafka:3.9.0` (KRaft 模式, Java 21 LTS 推荐, 3 节点 Raft 仲裁, 直连 MinIO S3 做数据归档)
- **ZooKeeper**: `zookeeper:3.9.3` (Java 21 LTS 兼容, 3 节点仲裁集群, client: 2181, peer: 2888, leader: 3888)
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

## 7. 后端执行模式配置 (Simulator 模式 vs 真实宿主机执行)

为防止开发/演示阶段误操作真实生产集群，系统内置了 `SIMULATOR` 配置开关：

### 配置方式：
1. **环境变量配置 (`.env` 或系统环境变量)**：
   ```bash
   # 开启模拟模式（只生成命令与模拟返回，不真实执行系统命令）
   export SIMULATOR=true

   # 关闭模拟模式（默认：直接在宿主机真实执行 helm / systemctl 等命令）
   export SIMULATOR=false
   ```
2. **Web 界面动态一键切换**：
   在页面顶部 Header 的 `Backend Mode` 开关处，可随时点击在 `[🧪 Simulator (Dry-run)]` 与 `[⚡ Real Host (Live)]` 之间热切换。
3. **返回规则**：
   - 当 `simulator=true` 时：返回 `mode: 'simulated_or_ready'`，不执行系统底层命令。
   - 当 `simulator=false` 时：命令直接在真实后端 Host Server 上执行：
     - 若执行成功，返回 `mode: 'live_k8s_applied'` 或 `mode: 'live_executed'` 并携带服务器真实 `stdout` 输出；
     - 若命令执行失败，直接返回 HTTP 500 与真实系统错误信息（`stderr` 及 `exitCode`），绝不隐瞒真实异常。

---

## 8. 3 台物理主机下 MySQL & MongoDB 持久化存储与 S3 冷备份实战 (方案 3 - 当前生效标准)

### 核心结论：直接挂载 S3 放数据目录不可行，但采用“本地盘 + S3 冷备份”是黄金标准！

> **为什么不能直接把 `/var/lib/mysql` 或 `/data/db` 挂载到 S3？**
> - **S3 是对象存储 (Object Storage)**，缺少 POSIX 字节级文件锁与原子扇区刷盘保证（`fsync()`）。
> - 若使用 s3fs 挂载，每次数据库 16KB 页更新需全量反复下载重传，延迟由 `<0.5ms` 暴增至 `500~1000ms+`，网络轻微抖动即可能导致**表空间彻底损坏**。

### 生产标准落地方案（方案 3）：

1. **日常高性能读写**：
   - 3 台物理机各自使用本地高速 NVMe/SSD 挂载路径（`/opt/kubernetes/data/`）。
   - 享受硬件原生满速 IOPS（100,000+）与微秒级响应延迟。
2. **MongoDB 采用 3 节点高可用副本集群 (ReplicaSet `rs0`)**：
   - 3 个 Pod 分布式调度在 3 台物理主机：`mongodb-0`（Master 1）、`mongodb-1`（Master 2）、`mongodb-2`（Master 3）；
   - 1 Primary + 2 Secondaries 构成 Raft 选举与 Oplog 同步链条，任一节点断电 3~5 秒内自动秒级无感选举新主库；
   - 业务访问入口统一通过集群 DNS：`mongodb.data-platform.svc.cluster.local:27017` 或 ReplicaSet 连接串：
     ```text
     mongodb://admin:mongoAdminPassword123@mongodb-0.mongodb-headless:27017,mongodb-1.mongodb-headless:27017,mongodb-2.mongodb-headless:27017/?replicaSet=rs0&authSource=admin
     ```
3. **跨机与灾难恢复安全兜底：MySQL & MongoDB 均开启 S3 冷备份，且 S3 严格只保留 3 份数据**：
   - **自动化 CronJob**：由 Kubernetes 定时触发，无锁抽取一致性快照与变更日志，流式上传到中央 MinIO / AWS S3 对象存储桶；
   - **3 份保留策略 (Retention Policy = 3)**：备份任务上传完成后，脚本自动对比时间戳，**自动销毁清理更早的历史备份，S3 桶内严格恒定只保留最新的 3 份冷备数据**，杜绝对象存储磁盘被写满；
   - **异地灾备**：即使 3 台物理机全部遭遇不可逆毁灭性硬件故障，也能从 S3 最新 3 份备份中瞬时恢复至期望时间点。

---

### S3 冷备份运维实战命令与灾难恢复演练

#### 1. 查看 MinIO S3 存储桶中的 3 份冷备文件（确认只保留 3 份）：
```bash
# 配置 MinIO 客户端 (mc)
mc alias set myminio http://192.168.1.100:9000 minioAdmin minioAdminPassword123

# 列出 MySQL 与 MongoDB 冷备份文件列表 (恒定仅 3 个文件)
mc ls myminio/mysql-backups/
mc ls myminio/mongodb-backups/
```

#### 2. 手动立即触发一次 S3 冷备份（验证备份并自动裁剪只留 3 份）：
```bash
# 手动触发 MongoDB 副本集群冷备份 Job
kubectl create job --from=cronjob/mongodb-backup-to-s3 manual-mongo-backup -n data-platform

# 手动触发 MySQL 8.4 冷备份 Job
kubectl create job --from=cronjob/mysql-backup-to-s3 manual-mysql-backup -n data-platform

# 检查备份 Pod 执行日志与自动裁剪旧备份的过程
kubectl logs -n data-platform -l app=mongodb-backup --tail=50
kubectl logs -n data-platform -l app=mysql-backup --tail=50
```

#### 3. 灾难恢复演练（从 S3 拉取冷备份文件一键还原）：

* **从 S3 还原 MongoDB 副本集群数据**：
  ```bash
  # 下载 S3 最新冷备归档文件
  mc cp myminio/mongodb-backups/mongo_latest.archive.gz /tmp/mongo_restore.archive.gz

  # 通过 mongorestore 流式回放恢复（含 Oplog 事务）
  mongorestore --host="mongodb-0.mongodb-headless:27017" \
    --username="admin" --password="mongoAdminPassword123" --authenticationDatabase="admin" \
    --oplogReplay --archive=/tmp/mongo_restore.archive.gz --drop
  ```

* **从 S3 还原 MySQL 8.4 数据库**：
  ```bash
  # 下载 S3 最新 SQL 归档压缩包
  mc cp myminio/mysql-backups/mysql_latest.sql.gz /tmp/mysql_restore.sql.gz

  # 解压并流式导入 MySQL 主节点
  gunzip < /tmp/mysql_restore.sql.gz | mysql -h mysql-0.mysql-headless -u root -pmysqlRootPassword123
  ```

