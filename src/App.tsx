import React, { useState, useMemo, useEffect } from 'react';
import { 
  Server, Database, Cloud, HardDrive, Cpu, Terminal, Copy, Check, 
  Layers, Shield, RefreshCw, Play, Settings, Download, ExternalLink,
  ChevronRight, Box, Activity, Sliders, FileText, CheckCircle2, AlertTriangle,
  Search, Plus, Minus, Eye, Trash2, ArrowUpRight, Zap, Radio, Globe, Key, User, Folder, Lock, AlertCircle, X, HelpCircle, Code,
  TrendingUp, BarChart3
} from 'lucide-react';

export interface TopicMetricDetail {
  topic: string;
  totalMessages: number;
  ratePerSec: number;
  consumerGroup: string;
  currentLag: number;
  status: 'HEALTHY' | 'WARNING';
  partitions: { id: number; lag: number; endOffset: number; currentOffset: number }[];
  history: { time: string; msgRate: number; lag: number }[];
}

interface K8sNode {
  id: string;
  hostname: string;
  ip: string;
  sshUser: string;
  sshPort: number;
  installDir: string;
  roles: ('control-plane' | 'master' | 'worker')[];
  status: 'Ready' | 'NotReady' | 'Provisioning';
  keepalivedRole: 'MASTER' | 'BACKUP' | 'N/A';
  cpu: string;
  mem: string;
  disk: string;
}

interface FlinkJob {
  id: string;
  name: string;
  roleDescription: string;
  status: 'RUNNING' | 'FINISHED' | 'CANCELED';
  startTime: string;
  duration: string;
  parallelism: number;
  slots: number;
  checkpointLocation: string;
}

interface ConfirmModalData {
  isOpen: boolean;
  title: string;
  actionType: 'add_k8s_node' | 'remove_k8s_node' | 'scale_kafka' | 'scale_mongo' | 'scale_flink' | 'scale_mysql' | 'scale_redis' | 'scale_zk' | 'update_vip';
  targetName: string;
  details: string;
  warningText?: string;
  confirmLabel: string;
  isDestructive: boolean;
  onConfirm: () => void;
}

interface WorkerCliModalData {
  isOpen: boolean;
  hostname: string;
  ip: string;
  script: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'k8s_nodes' | 'credentials' | 'extensions' | 'k9s' | 'topology' | 'storage' | 'values' | 'manifests' | 'runbook'>('k8s_nodes');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Execution Mode: Backend Direct execution vs Manual CLI mode
  const [executionMode, setExecutionMode] = useState<'backend' | 'manual'>('backend');

  // Dynamic cluster configurations
  const [flinkTaskManagers, setFlinkTaskManagers] = useState<number>(3);
  const [kafkaReplicas, setKafkaReplicas] = useState<number>(3);
  const [zkReplicas, setZkReplicas] = useState<number>(3);
  const [mongoReplicas, setMongoReplicas] = useState<number>(3); // 3-member ReplicaSet (rs0) across 3 physical hosts
  const [mysqlReplicas, setMysqlReplicas] = useState<number>(3);
  const [redisReplicas, setRedisReplicas] = useState<number>(3);
  const [minioReplicas, setMinioReplicas] = useState<number>(4);
  const [useKraft, setUseKraft] = useState<boolean>(true);
  const [enableZookeeper, setEnableZookeeper] = useState<boolean>(true);
  const [s3Endpoint, setS3Endpoint] = useState<string>('http://minio:9000');

  // Master Initial Cluster Credentials State (Enforced Auth on All Components)
  const [minioUser, setMinioUser] = useState<string>('minioAdmin');
  const [minioPassword, setMinioPassword] = useState<string>('minioAdminPassword123');

  const [mysqlRootPassword, setMysqlRootPassword] = useState<string>('mysqlRootPassword123');
  const [mysqlAppUser, setMysqlAppUser] = useState<string>('app_user');
  const [mysqlAppPassword, setMysqlAppPassword] = useState<string>('mysqlAppPassword123');
  const [mysqlReplPassword, setMysqlReplPassword] = useState<string>('replPassword123');

  const [mongoRootUser, setMongoRootUser] = useState<string>('admin');
  const [mongoRootPassword, setMongoRootPassword] = useState<string>('mongoAdminPassword123');
  const [mongoAppUser, setMongoAppUser] = useState<string>('mongo_app');
  const [mongoAppPassword, setMongoAppPassword] = useState<string>('mongoAppPassword123');

  const [redisPassword, setRedisPassword] = useState<string>('redisAuthPassword123');

  const [kafkaAdminUser, setKafkaAdminUser] = useState<string>('admin');
  const [kafkaAdminPassword, setKafkaAdminPassword] = useState<string>('kafkaAdminPassword123');
  const [kafkaAppUser, setKafkaAppUser] = useState<string>('app_user');
  const [kafkaAppPassword, setKafkaAppPassword] = useState<string>('kafkaAppPassword123');

  const [zkAdminUser, setZkAdminUser] = useState<string>('zkAdmin');
  const [zkAdminPassword, setZkAdminPassword] = useState<string>('zkAdminPassword123');

  const [flinkAdminUser, setFlinkAdminUser] = useState<string>('flinkAdmin');
  const [flinkAdminPassword, setFlinkAdminPassword] = useState<string>('flinkAdminPassword123');

  const [showAllPasswords, setShowAllPasswords] = useState<boolean>(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState<boolean>(false);
  const [selectedAppLang, setSelectedAppLang] = useState<'spring' | 'zookeeper' | 'python' | 'nodejs' | 'go'>('spring');
  const [customTargetDb, setCustomTargetDb] = useState<string>('appdb');

  // External Git Connectivity State
  const [gitTestUrl, setGitTestUrl] = useState<string>('https://github.com/torvalds/linux.git');
  const [gitTestLoading, setGitTestLoading] = useState<boolean>(false);
  const [gitTestResult, setGitTestResult] = useState<{
    success: boolean;
    accessible: boolean;
    durationMs?: number;
    output?: string;
    message?: string;
    error?: string;
    suggestion?: string;
  } | null>(null);

  const testGitConnectivity = async (targetOverride?: string) => {
    const url = targetOverride || gitTestUrl;
    setGitTestLoading(true);
    setGitTestResult(null);
    try {
      const res = await fetch('/api/git/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setGitTestResult(data);
    } catch (e: any) {
      setGitTestResult({
        success: false,
        accessible: false,
        error: e.message,
        suggestion: '无法连接后端探查服务，请确认后端 3000 端口服务正常。'
      });
    } finally {
      setGitTestLoading(false);
    }
  };

  // Confirmation Modal State (Required for add/remove node, Kafka, Mongo, Flink etc.)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData>({
    isOpen: false,
    title: '',
    actionType: 'add_k8s_node',
    targetName: '',
    details: '',
    confirmLabel: 'Confirm',
    isDestructive: false,
    onConfirm: () => {}
  });

  // Dedicated Worker Node CLI Modal (Manual execution on physical machine/VM)
  const [workerCliModal, setWorkerCliModal] = useState<WorkerCliModalData | null>(null);

  // K8s Cluster HA Control Plane State (Keepalived VIP or Domain FQDN + HAProxy)
  const [vipIp, setVipIp] = useState<string>('192.168.1.100');
  const [editingVip, setEditingVip] = useState<string>('192.168.1.100');
  const [vipPort, setVipPort] = useState<number>(6443);
  const [netInterface, setNetInterface] = useState<string>('auto');
  const [isUpdatingVip, setIsUpdatingVip] = useState<boolean>(false);
  const [vipUpdateNotice, setVipUpdateNotice] = useState<string | null>(null);
  const [isSimulatorMode, setIsSimulatorMode] = useState<boolean>(false);
  const [storageSolutionTab, setStorageSolutionTab] = useState<'replica' | 'distributed' | 's3_hybrid'>('s3_hybrid');
  const [vipUpdateResult, setVipUpdateResult] = useState<{
    isOpen: boolean;
    oldEndpoint: string;
    newEndpoint: string;
    port: number;
    isDomain: boolean;
    updatedFiles: string[];
    restartedServices: string[];
    logs: string[];
  } | null>(null);

  // Initial 3 Master Nodes (also running Worker workloads) + Extension Workers
  const [k8sNodes, setK8sNodes] = useState<K8sNode[]>([
    {
      id: 'node-1',
      hostname: 'k8s-master-01',
      ip: '192.168.1.101',
      sshUser: 'root',
      sshPort: 22,
      installDir: '/opt/kubernetes',
      roles: ['control-plane', 'master', 'worker'],
      status: 'Ready',
      keepalivedRole: 'MASTER',
      cpu: '24% (4 Core)',
      mem: '38% (16 GB)',
      disk: '120GB / 500GB'
    },
    {
      id: 'node-2',
      hostname: 'k8s-master-02',
      ip: '192.168.1.102',
      sshUser: 'root',
      sshPort: 22,
      installDir: '/opt/kubernetes',
      roles: ['control-plane', 'master', 'worker'],
      status: 'Ready',
      keepalivedRole: 'BACKUP',
      cpu: '20% (4 Core)',
      mem: '35% (16 GB)',
      disk: '115GB / 500GB'
    },
    {
      id: 'node-3',
      hostname: 'k8s-master-03',
      ip: '192.168.1.103',
      sshUser: 'root',
      sshPort: 22,
      installDir: '/opt/kubernetes',
      roles: ['control-plane', 'master', 'worker'],
      status: 'Ready',
      keepalivedRole: 'BACKUP',
      cpu: '18% (4 Core)',
      mem: '33% (16 GB)',
      disk: '110GB / 500GB'
    }
  ]);

  // Form state for Adding an Extension Worker Node
  const [newWorkerHostname, setNewWorkerHostname] = useState<string>('k8s-worker-04');
  const [newWorkerIp, setNewWorkerIp] = useState<string>('192.168.1.104');
  const [newWorkerSshUser, setNewWorkerSshUser] = useState<string>('root');
  const [newWorkerSshPort, setNewWorkerSshPort] = useState<number>(22);
  const [newWorkerInstallDir, setNewWorkerInstallDir] = useState<string>('/opt/kubernetes');
  const [provisioningMessage, setProvisioningMessage] = useState<string | null>(null);

  // Active Flink Streaming Jobs State
  // (Kafka-to-MinIO-S3 is directly handled by Kafka Connect S3 Sink without Flink;
  // MongoDB handles replication & sharding natively without Flink ETL;
  // CDC-MySQL-Binlog is removed as requested)
  const [flinkJobs, setFlinkJobs] = useState<FlinkJob[]>([
    {
      id: 'job-3a91c4',
      name: 'Realtime-Event-Metrics-Aggregator',
      roleDescription: '实时拉取 Kafka 各 Topic 业务事件，统计每个 Topic 消息量与 Consumer Group LAG 延迟，支持实时可视化图形呈现',
      status: 'RUNNING',
      startTime: '2026-09-27 08:30:12',
      duration: '54m 20s',
      parallelism: 4,
      slots: 4,
      checkpointLocation: 's3://flink-checkpoints/checkpoints/job-3a91c4/'
    }
  ]);

  // Topic metrics data with message volume and Consumer Group LAG
  const [topicMetrics, setTopicMetrics] = useState<TopicMetricDetail[]>([
    {
      topic: 'user-activity-stream',
      totalMessages: 1845200,
      ratePerSec: 2850,
      consumerGroup: 'analytics-worker-group',
      currentLag: 142,
      status: 'HEALTHY',
      partitions: [
        { id: 0, lag: 48, endOffset: 615060, currentOffset: 615012 },
        { id: 1, lag: 52, endOffset: 615100, currentOffset: 615048 },
        { id: 2, lag: 42, endOffset: 615040, currentOffset: 614998 }
      ],
      history: [
        { time: '11:15', msgRate: 2400, lag: 210 },
        { time: '11:17', msgRate: 2650, lag: 195 },
        { time: '11:19', msgRate: 3100, lag: 280 },
        { time: '11:21', msgRate: 2950, lag: 180 },
        { time: '11:23', msgRate: 2750, lag: 155 },
        { time: '11:25', msgRate: 2850, lag: 142 }
      ]
    },
    {
      topic: 'order-transactions',
      totalMessages: 624100,
      ratePerSec: 920,
      consumerGroup: 'fulfillment-billing-group',
      currentLag: 28,
      status: 'HEALTHY',
      partitions: [
        { id: 0, lag: 10, endOffset: 208040, currentOffset: 208030 },
        { id: 1, lag: 8, endOffset: 208035, currentOffset: 208027 },
        { id: 2, lag: 10, endOffset: 208025, currentOffset: 208015 }
      ],
      history: [
        { time: '11:15', msgRate: 850, lag: 45 },
        { time: '11:17', msgRate: 910, lag: 38 },
        { time: '11:19', msgRate: 940, lag: 50 },
        { time: '11:21', msgRate: 880, lag: 32 },
        { time: '11:23', msgRate: 900, lag: 30 },
        { time: '11:25', msgRate: 920, lag: 28 }
      ]
    },
    {
      topic: 'iot-telemetry-events',
      totalMessages: 4920800,
      ratePerSec: 6800,
      consumerGroup: 'realtime-alert-evaluator',
      currentLag: 412,
      status: 'WARNING',
      partitions: [
        { id: 0, lag: 140, endOffset: 1640400, currentOffset: 1640260 },
        { id: 1, lag: 132, endOffset: 1640250, currentOffset: 1640118 },
        { id: 2, lag: 140, endOffset: 1640150, currentOffset: 1640010 }
      ],
      history: [
        { time: '11:15', msgRate: 5800, lag: 290 },
        { time: '11:17', msgRate: 6400, lag: 340 },
        { time: '11:19', msgRate: 7200, lag: 490 },
        { time: '11:21', msgRate: 6900, lag: 460 },
        { time: '11:23', msgRate: 6600, lag: 430 },
        { time: '11:25', msgRate: 6800, lag: 412 }
      ]
    },
    {
      topic: 'payment-audit-logs',
      totalMessages: 312500,
      ratePerSec: 360,
      consumerGroup: 'risk-compliance-monitor',
      currentLag: 15,
      status: 'HEALTHY',
      partitions: [
        { id: 0, lag: 5, endOffset: 104200, currentOffset: 104195 },
        { id: 1, lag: 4, endOffset: 104150, currentOffset: 104146 },
        { id: 2, lag: 6, endOffset: 104150, currentOffset: 104144 }
      ],
      history: [
        { time: '11:15', msgRate: 310, lag: 22 },
        { time: '11:17', msgRate: 340, lag: 20 },
        { time: '11:19', msgRate: 380, lag: 28 },
        { time: '11:21', msgRate: 350, lag: 18 },
        { time: '11:23', msgRate: 340, lag: 16 },
        { time: '11:25', msgRate: 360, lag: 15 }
      ]
    }
  ]);

  const [showMetricsGraphModal, setShowMetricsGraphModal] = useState<boolean>(false);
  const [selectedTopicName, setSelectedTopicName] = useState<string>('user-activity-stream');
  const [showKafkaS3Modal, setShowKafkaS3Modal] = useState<boolean>(false);
  const [checkpointNotice, setCheckpointNotice] = useState<string | null>(null);
  const [newJobName, setNewJobName] = useState<string>('IoT-Sensor-Stream-Analytics');

  const handleTriggerCheckpoint = (jobId: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    setCheckpointNotice(`✅ S3 Checkpoint completed for ${jobId}! Saved to ${s3Endpoint}/flink-checkpoints/savepoints/savepoint-${timestamp}`);
    setTimeout(() => setCheckpointNotice(null), 5000);
  };

  const handleSubmitJob = () => {
    if (!newJobName) return;
    const newJob: FlinkJob = {
      id: `job-${Math.random().toString(36).substring(2, 8)}`,
      name: newJobName,
      roleDescription: '流式业务计算任务：消费 Kafka 事件并完成实时处理与分发',
      status: 'RUNNING',
      startTime: new Date().toLocaleTimeString(),
      duration: '1m',
      parallelism: 2,
      slots: 2,
      checkpointLocation: `s3://flink-checkpoints/checkpoints/${newJobName.toLowerCase()}/`
    };
    setFlinkJobs([newJob, ...flinkJobs]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Sync backend simulator mode configuration and initial credentials on component mount
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (typeof data.simulator === 'boolean') {
          setIsSimulatorMode(data.simulator);
        }
      })
      .catch(() => {});

    // Hydrate saved credentials from backend if available
    fetch('/api/credentials')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.credentials) {
          const c = data.credentials;
          if (c.MINIO_ROOT_USER) setMinioUser(c.MINIO_ROOT_USER);
          if (c.MINIO_ROOT_PASSWORD) setMinioPassword(c.MINIO_ROOT_PASSWORD);
          if (c.MYSQL_ROOT_PASSWORD) setMysqlRootPassword(c.MYSQL_ROOT_PASSWORD);
          if (c.MYSQL_APP_USER) setMysqlAppUser(c.MYSQL_APP_USER);
          if (c.MYSQL_APP_PASSWORD) setMysqlAppPassword(c.MYSQL_APP_PASSWORD);
          if (c.MYSQL_REPL_PASSWORD) setMysqlReplPassword(c.MYSQL_REPL_PASSWORD);
          if (c.MONGO_ROOT_USER) setMongoRootUser(c.MONGO_ROOT_USER);
          if (c.MONGO_ROOT_PASSWORD) setMongoRootPassword(c.MONGO_ROOT_PASSWORD);
          if (c.MONGO_APP_USER) setMongoAppUser(c.MONGO_APP_USER);
          if (c.MONGO_APP_PASSWORD) setMongoAppPassword(c.MONGO_APP_PASSWORD);
          if (c.REDIS_PASSWORD) setRedisPassword(c.REDIS_PASSWORD);
          if (c.KAFKA_ADMIN_USER) setKafkaAdminUser(c.KAFKA_ADMIN_USER);
          if (c.KAFKA_ADMIN_PASSWORD) setKafkaAdminPassword(c.KAFKA_ADMIN_PASSWORD);
          if (c.KAFKA_CLIENT_USER) setKafkaAppUser(c.KAFKA_CLIENT_USER);
          if (c.KAFKA_CLIENT_PASSWORD) setKafkaAppPassword(c.KAFKA_CLIENT_PASSWORD);
          if (c.ZK_ADMIN_USER) setZkAdminUser(c.ZK_ADMIN_USER);
          if (c.ZK_ADMIN_PASSWORD) setZkAdminPassword(c.ZK_ADMIN_PASSWORD);
          if (c.FLINK_ADMIN_USER) setFlinkAdminUser(c.FLINK_ADMIN_USER);
          if (c.FLINK_ADMIN_PASSWORD) setFlinkAdminPassword(c.FLINK_ADMIN_PASSWORD);
        }
      })
      .catch(() => {});
  }, []);

  const toggleSimulatorMode = async () => {
    const nextVal = !isSimulatorMode;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulator: nextVal })
      });
      const data = await res.json();
      if (data.success) {
        setIsSimulatorMode(data.simulator);
        setProvisioningMessage(data.message);
        setTimeout(() => setProvisioningMessage(null), 5000);
      }
    } catch (e) {
      setIsSimulatorMode(nextVal);
    }
  };

  // Save current credentials to backend credentials.env & helm/custom-credentials.yaml
  const saveCredentialsToServer = async () => {
    setIsSavingCredentials(true);
    try {
      const payload = {
        MINIO_ROOT_USER: minioUser,
        MINIO_ROOT_PASSWORD: minioPassword,
        MYSQL_ROOT_PASSWORD: mysqlRootPassword,
        MYSQL_APP_USER: mysqlAppUser,
        MYSQL_APP_PASSWORD: mysqlAppPassword,
        MYSQL_REPL_PASSWORD: mysqlReplPassword,
        MONGO_ROOT_USER: mongoRootUser,
        MONGO_ROOT_PASSWORD: mongoRootPassword,
        MONGO_APP_USER: mongoAppUser,
        MONGO_APP_PASSWORD: mongoAppPassword,
        REDIS_PASSWORD: redisPassword,
        KAFKA_ADMIN_USER: kafkaAdminUser,
        KAFKA_ADMIN_PASSWORD: kafkaAdminPassword,
        KAFKA_CLIENT_USER: kafkaAppUser,
        KAFKA_CLIENT_PASSWORD: kafkaAppPassword,
        ZK_ADMIN_USER: zkAdminUser,
        ZK_ADMIN_PASSWORD: zkAdminPassword,
        FLINK_ADMIN_USER: flinkAdminUser,
        FLINK_ADMIN_PASSWORD: flinkAdminPassword,
        K8S_JOIN_TOKEN: 'abcdef.0123456789abcdef'
      };

      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: payload })
      });
      const data = await res.json();
      if (data.success) {
        setProvisioningMessage('✅ [Credentials Vault]: 已成功保存并同步初始凭证到 credentials.env 与 helm/custom-credentials.yaml！');
      } else {
        setProvisioningMessage(`❌ 保存凭证失败: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setProvisioningMessage(`❌ 同步凭证接口异常: ${err.message}`);
    } finally {
      setIsSavingCredentials(false);
      setTimeout(() => setProvisioningMessage(null), 5000);
    }
  };

  // Download credentials as .env file
  const downloadCredentialsEnv = () => {
    const envContent = `# CloudCluster Initial Authentication Credentials (.env)
# MinIO S3
MINIO_ROOT_USER=${minioUser}
MINIO_ROOT_PASSWORD=${minioPassword}

# MySQL 8.4
MYSQL_ROOT_PASSWORD=${mysqlRootPassword}
MYSQL_APP_USER=${mysqlAppUser}
MYSQL_APP_PASSWORD=${mysqlAppPassword}
MYSQL_REPL_PASSWORD=${mysqlReplPassword}

# MongoDB 8.0 (ReplicaSet rs0)
MONGO_ROOT_USER=${mongoRootUser}
MONGO_ROOT_PASSWORD=${mongoRootPassword}
MONGO_APP_USER=${mongoAppUser}
MONGO_APP_PASSWORD=${mongoAppPassword}

# Redis 6.2
REDIS_PASSWORD=${redisPassword}

# Kafka 3.7
KAFKA_ADMIN_USER=${kafkaAdminUser}
KAFKA_ADMIN_PASSWORD=${kafkaAdminPassword}
KAFKA_CLIENT_USER=${kafkaAppUser}
KAFKA_CLIENT_PASSWORD=${kafkaAppPassword}

# ZooKeeper 3.6
ZK_ADMIN_USER=${zkAdminUser}
ZK_ADMIN_PASSWORD=${zkAdminPassword}

# Flink 1.9
FLINK_ADMIN_USER=${flinkAdminUser}
FLINK_ADMIN_PASSWORD=${flinkAdminPassword}
`;
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credentials.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setProvisioningMessage('💾 [Export]: 已成功下载 credentials.env 环境变量文件！');
    setTimeout(() => setProvisioningMessage(null), 4000);
  };

  // Helper to generate a strong random 16-character alphanumeric password
  const generateRandomPassword = () => {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#%*';
    let pwd = '';
    for (let i = 0; i < 16; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  // One-click batch generate secure random passwords for all services
  const generateAllRandomPasswords = () => {
    setMinioPassword(generateRandomPassword());
    setMysqlRootPassword(generateRandomPassword());
    setMysqlAppPassword(generateRandomPassword());
    setMysqlReplPassword(generateRandomPassword());
    setMongoRootPassword(generateRandomPassword());
    setMongoAppPassword(generateRandomPassword());
    setRedisPassword(generateRandomPassword());
    setKafkaAdminPassword(generateRandomPassword());
    setKafkaAppPassword(generateRandomPassword());
    setZkAdminPassword(generateRandomPassword());
    setFlinkAdminPassword(generateRandomPassword());
    setProvisioningMessage('🔑 [Credentials Vault]: 已为所有 8 大服务一键生成 16 位高强度安全密码！');
    setTimeout(() => setProvisioningMessage(null), 6000);
  };

  // Reset to default development passwords
  const resetDefaultCredentials = () => {
    setMinioUser('minioAdmin');
    setMinioPassword('minioAdminPassword123');
    setMysqlRootPassword('mysqlRootPassword123');
    setMysqlAppUser('app_user');
    setMysqlAppPassword('mysqlAppPassword123');
    setMysqlReplPassword('replPassword123');
    setMongoRootUser('admin');
    setMongoRootPassword('mongoAdminPassword123');
    setMongoAppUser('mongo_app');
    setMongoAppPassword('mongoAppPassword123');
    setRedisPassword('redisAuthPassword123');
    setKafkaAdminUser('admin');
    setKafkaAdminPassword('kafkaAdminPassword123');
    setKafkaAppUser('app_user');
    setKafkaAppPassword('kafkaAppPassword123');
    setZkAdminUser('zkAdmin');
    setZkAdminPassword('zkAdminPassword123');
    setFlinkAdminUser('flinkAdmin');
    setFlinkAdminPassword('flinkAdminPassword123');
    setProvisioningMessage('🔄 [Credentials Vault]: 所有服务账号密码已重置为标准默认凭证。');
    setTimeout(() => setProvisioningMessage(null), 5000);
  };

  // Copy comprehensive credentials sheet
  const copyAllCredentialsSheet = () => {
    const sheet = `# ==============================================================================
# CloudCluster Master Initial Credentials Sheet (初始安装账号密码汇总清单)
# VIP Gateway: ${vipIp} (Port 6443 / Keepalived + HAProxy)
# ==============================================================================

1. MinIO S3 Object Storage (Port 9000 API / Port 9001 Console)
   Root User:     ${minioUser}
   Root Password: ${minioPassword}
   Console URL:   http://${vipIp}:9001

2. MySQL 8.4 Database (Port 3306)
   Root User:     root
   Root Password: ${mysqlRootPassword}
   App User:      ${mysqlAppUser}
   App Password:  ${mysqlAppPassword}
   Replica User:  repl_user / ${mysqlReplPassword}
   Database:      appdb

3. MongoDB 8.0 3-Member ReplicaSet rs0 (Port 27017)
   Admin User:    ${mongoRootUser}
   Admin Password:${mongoRootPassword}
   App User:      ${mongoAppUser}
   App Password:  ${mongoAppPassword}
   Keyfile:       mongodb-keyfile-secret

4. Redis 6.2 Sentinel Cache (Port 6379 / Sentinel 26379)
   Auth Password: ${redisPassword}
   MasterAuth:    ${redisPassword}

5. Apache Kafka 3.7 KRaft (Port 9092 SASL_PLAINTEXT)
   Admin User:    ${kafkaAdminUser}
   Admin Password:${kafkaAdminPassword}
   Client User:   ${kafkaAppUser}
   Client Password:${kafkaAppPassword}
   Security:      SASL_PLAINTEXT (PlainLoginModule)

6. Apache ZooKeeper 3.6.3 (Port 2181)
   Admin User:    ${zkAdminUser}
   Admin Password:${zkAdminPassword}
   Security:      SASL Digest Auth

7. Apache Flink 1.9.3 (Port 8081 Dashboard & REST API)
   Admin User:    ${flinkAdminUser}
   Admin Password:${flinkAdminPassword}
   Dashboard URL: http://${vipIp}:8081

8. Kubernetes Cluster Control Plane
   Admin User:    kubernetes-admin
   VIP API Server:https://${vipIp}:${vipPort}
`;
    copyToClipboard(sheet, 'all-credentials');
    setProvisioningMessage('📋 [Credentials Vault]: 已成功复制全套服务初始账号密码清单到剪贴板！');
    setTimeout(() => setProvisioningMessage(null), 5000);
  };

  // Download credentials YAML
  const downloadCredentialsYaml = () => {
    const yamlContent = `# CloudCluster Initial Credentials Configuration
credentials:
  minio:
    endpoint: "http://${vipIp}:9000"
    console: "http://${vipIp}:9001"
    rootUser: "${minioUser}"
    rootPassword: "${minioPassword}"
  mysql:
    port: 3306
    rootUser: "root"
    rootPassword: "${mysqlRootPassword}"
    appUser: "${mysqlAppUser}"
    appPassword: "${mysqlAppPassword}"
    database: "appdb"
  mongodb:
    port: 27017
    replicaSet: "rs0"
    adminUser: "${mongoRootUser}"
    adminPassword: "${mongoRootPassword}"
    appUser: "${mongoAppUser}"
    appPassword: "${mongoAppPassword}"
  redis:
    port: 6379
    password: "${redisPassword}"
  kafka:
    port: 9092
    protocol: "SASL_PLAINTEXT"
    adminUser: "${kafkaAdminUser}"
    adminPassword: "${kafkaAdminPassword}"
    clientUser: "${kafkaAppUser}"
    clientPassword: "${kafkaAppPassword}"
  zookeeper:
    port: 2181
    adminUser: "${zkAdminUser}"
    adminPassword: "${zkAdminPassword}"
  flink:
    port: 8081
    adminUser: "${flinkAdminUser}"
    adminPassword: "${flinkAdminPassword}"
`;
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'initial-cluster-credentials.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setProvisioningMessage('💾 [Export]: 已成功下载 initial-cluster-credentials.yaml 文件！');
    setTimeout(() => setProvisioningMessage(null), 4000);
  };

  // Trigger Confirmation Modal Helper
  const triggerConfirmation = (modalConfig: Omit<ConfirmModalData, 'isOpen'>) => {
    setConfirmModal({
      ...modalConfig,
      isOpen: true
    });
  };

  // Backend Direct Execution for Pod Extensions
  const executePodScale = async (component: string, replicas: number) => {
    if (executionMode === 'backend') {
      try {
        const response = await fetch('/api/k8s/scale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component, replicas, namespace: 'data-platform' })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          if (data.simulator) {
            setProvisioningMessage(`🧪 [Simulator Dry-Run]: ${data.message}`);
          } else {
            setProvisioningMessage(`⚡ [Host Server Live]: ${data.message}`);
          }
        } else {
          setProvisioningMessage(`❌ [Host Server Error]: ${data.error || data.message || 'Execution error on backend'}`);
        }
      } catch (err: any) {
        setProvisioningMessage(`❌ [Connection Error]: Failed connecting to server: ${err?.message || err}`);
      }
    } else {
      const cmd = `helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set ${component}.replicas=${replicas}`;
      copyToClipboard(cmd, 'scale-cmd');
      setProvisioningMessage(`📋 [Manual CLI Mode]: Generated and copied: ${cmd}`);
    }
    setTimeout(() => setProvisioningMessage(null), 7000);
  };

  // Handle Add Extension Worker Node: Generates CLI for physical/VM execution
  const requestAddWorkerNode = () => {
    triggerConfirmation({
      title: 'Confirm Adding Kubernetes Worker Node',
      actionType: 'add_k8s_node',
      targetName: `${newWorkerHostname} (${newWorkerIp})`,
      details: `Target machine: ${newWorkerIp}:${newWorkerSshPort} | Install Dir: ${newWorkerInstallDir}. Since worker extension must be executed on the physical machine/VM, clicking confirm will generate the exact CLI script for manual execution.`,
      warningText: 'Target server requires containerd and network connectivity to VIP 192.168.1.100:6443.',
      confirmLabel: 'Generate Worker Join CLI',
      isDestructive: false,
      onConfirm: () => {
        // Generate CLI script
        const cliScript = `#!/usr/bin/env bash
# ==============================================================================
# Run this script directly on ${newWorkerHostname} (${newWorkerIp}) as root/sudo
# ==============================================================================
set -euo pipefail

echo "==> Step 1: Create directory & install dependencies"
mkdir -p ${newWorkerInstallDir}
cd ${newWorkerInstallDir}

# Install containerd & kubeadm if not installed
if ! command -v kubeadm &> /dev/null; then
  echo "Installing containerd & kubeadm..."
  apt-get update && apt-get install -y containerd kubeadm
  systemctl enable --now containerd
fi

echo "==> Step 2: Join Kubernetes cluster via VIP (${vipIp}:${vipPort})"
sudo kubeadm join "${vipIp}:${vipPort}" \\
  --token "abcdef.0123456789abcdef" \\
  --discovery-token-ca-cert-hash "sha256:7b81c2f90a12e34d56c78a90bcdef1234567890abcdef1234567890abcdef12"

echo "==> [SUCCESS] ${newWorkerHostname} has joined the cluster!"
echo "Verify on Master: kubectl get nodes"
`;

        // Add node to inventory
        const newNode: K8sNode = {
          id: `node-${Date.now()}`,
          hostname: newWorkerHostname,
          ip: newWorkerIp,
          sshUser: newWorkerSshUser,
          sshPort: newWorkerSshPort,
          installDir: newWorkerInstallDir,
          roles: ['worker'],
          status: 'Ready',
          keepalivedRole: 'N/A',
          cpu: '8% (8 Core)',
          mem: '14% (32 GB)',
          disk: '45GB / 1000GB'
        };
        setK8sNodes([...k8sNodes, newNode]);

        // Open Worker CLI Runbook Modal
        setWorkerCliModal({
          isOpen: true,
          hostname: newWorkerHostname,
          ip: newWorkerIp,
          script: cliScript
        });
      }
    });
  };

  // Handle VIP / Domain Endpoint Update with Confirmation Modal & Automatic Service Restart
  const requestUpdateVip = () => {
    const cleanNew = editingVip.trim();
    if (!cleanNew) return;
    if (cleanNew === vipIp) {
      setVipUpdateNotice('当前配置终端未变更');
      setTimeout(() => setVipUpdateNotice(null), 3000);
      return;
    }

    const isDomain = !/^[0-9.]+$/.test(cleanNew);

    triggerConfirmation({
      title: '确认修改高可用集群 VIP / 接入域名 (Confirm Updating VIP / Domain Endpoint)',
      actionType: 'update_vip',
      targetName: `${vipIp}:${vipPort} → ${cleanNew}:${vipPort}`,
      details: `集群接入终端将从 ${vipIp} 修改为 ${cleanNew} (${isDomain ? 'Domain / 域名模式' : 'Virtual IP / 虚拟IP模式'})。点击确认后，后端将自动更新所有 8 个关联配置文件并重启对应服务。`,
      warningText: isDomain
        ? '注意：采用域名接入时，请确保内网 DNS 或各节点 /etc/hosts 已将该域名解析至 Master 节点或负载均衡器！'
        : '注意：切换虚拟 IP 时，Keepalived 将自动释放旧 VIP 并接管新 VIP。',
      confirmLabel: '确认并自动修改配置与重启服务',
      isDestructive: false,
      onConfirm: async () => {
        setIsUpdatingVip(true);
        try {
          const res = await fetch('/api/k8s/update-vip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oldEndpoint: vipIp,
              newEndpoint: cleanNew,
              port: vipPort,
              isDomain,
              netInterface
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setVipIp(cleanNew);
            setVipUpdateResult({
              isOpen: true,
              oldEndpoint: data.oldEndpoint || vipIp,
              newEndpoint: data.newEndpoint || cleanNew,
              port: data.port || vipPort,
              isDomain: data.isDomain !== undefined ? data.isDomain : isDomain,
              updatedFiles: data.updatedFiles || [
                '/etc/keepalived/keepalived.conf',
                '/etc/haproxy/haproxy.cfg',
                '/etc/kubernetes/kubeadm-config.yaml',
                '/etc/kubernetes/admin.conf',
                '/etc/kubernetes/kubelet.conf',
                '/etc/kubernetes/controller-manager.conf',
                '/etc/kubernetes/scheduler.conf',
                './helm/values.yaml'
              ],
              restartedServices: data.restartedServices || [
                'keepalived.service',
                'haproxy.service',
                'kube-apiserver (static pod reload via cert SAN update)',
                'kubelet.service'
              ],
              logs: data.logs || [
                `[1/5] Verified endpoint format: "${cleanNew}" (${isDomain ? 'Domain / FQDN 域名模式' : 'Virtual IP 地址模式'})`,
                `[2/5] Patched 8 configuration files: Keepalived, HAProxy, kubeadm-config.yaml, and Kubeconfigs`,
                `[3/5] Re-signed API server certificates with SAN "${cleanNew}"`,
                `[4/5] Auto-restarted services: Keepalived, HAProxy, and Kubelet`,
                `[5/5] Re-established control plane quorum on port ${vipPort}`
              ]
            });
            setVipUpdateNotice(data.simulator ? `🧪 [Simulator Mode] 模拟完成高可用终端更新！` : `✅ [Host Server Live] 成功切换至终端 ${cleanNew}:${vipPort}！配置文件已全部更新，受影响服务已自动重启。`);
            setTimeout(() => setVipUpdateNotice(null), 8000);
          } else {
            setVipUpdateNotice(`❌ [Host Server Error] 终端修改执行失败: ${data.error || data.message}`);
            setTimeout(() => setVipUpdateNotice(null), 10000);
          }
        } catch (e: any) {
          console.error('Failed to update VIP:', e);
          setVipUpdateNotice(`❌ [Network Error] 请求后端服务器异常: ${e?.message || e}`);
          setTimeout(() => setVipUpdateNotice(null), 8000);
        } finally {
          setIsUpdatingVip(false);
        }
      }
    });
  };

  // Handle Remove Worker Node with Modal
  const requestRemoveNode = (node: K8sNode) => {
    const isMaster = node.roles.includes('control-plane');
    triggerConfirmation({
      title: isMaster ? 'WARNING: Remove Control-Plane Master Node' : 'Confirm Drain & Remove Worker Node',
      actionType: 'remove_k8s_node',
      targetName: `${node.hostname} (${node.ip})`,
      details: `Node ${node.hostname} will be cordoned, drained of all pods, and removed from the cluster (${node.ip}). Running pods will be rescheduled to remaining nodes.`,
      warningText: isMaster 
        ? 'DANGER: Removing a master node will reduce etcd quorum from 3 to 2. At least 2 control planes are needed for high availability!'
        : 'All pods running on this worker will be evicted and rescheduled.',
      confirmLabel: 'Drain & Remove Node',
      isDestructive: true,
      onConfirm: () => {
        setK8sNodes(k8sNodes.filter(n => n.id !== node.id));
        setProvisioningMessage(`🗑️ Node ${node.hostname} has been successfully drained and removed.`);
        setTimeout(() => setProvisioningMessage(null), 5000);
      }
    });
  };

  // Handle Kafka Scale with Modal & Backend Execution
  const requestScaleKafka = (newCount: number) => {
    const isDownscale = newCount < kafkaReplicas;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Downscaling Kafka KRaft Nodes' : 'Confirm Scaling Kafka KRaft Quorum',
      actionType: 'scale_kafka',
      targetName: `Kafka Cluster: ${kafkaReplicas} → ${newCount} Nodes`,
      details: `Kafka KRaft metadata quorum will be reconfigured. Voting members will be adjusted to ${newCount} brokers/controllers.`,
      warningText: isDownscale 
        ? 'Ensure all topic partition replicas on decommissioned nodes are reassigned before terminating pods!'
        : 'Quorum requires (N/2)+1 active votes for Raft metadata consensus.',
      confirmLabel: isDownscale ? 'Downscale Kafka' : 'Scale Kafka',
      isDestructive: isDownscale,
      onConfirm: () => {
        setKafkaReplicas(newCount);
        executePodScale('kafka', newCount);
      }
    });
  };

  // Handle ZooKeeper Scale with Modal & Backend Execution
  const requestScaleZooKeeper = (newCount: number) => {
    const isDownscale = newCount < zkReplicas;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Downscaling ZooKeeper Quorum' : 'Confirm Scaling ZooKeeper Ensemble',
      actionType: 'scale_zk',
      targetName: `Apache ZooKeeper 3.6.3: ${zkReplicas} → ${newCount} Members`,
      details: `ZooKeeper quorum ensemble will update configuration with ${newCount} servers (requires floor(N/2)+1 votes).`,
      warningText: isDownscale && (newCount < 3)
        ? 'DANGER: ZooKeeper ensemble should always maintain an odd number of servers (3, 5, 7) for split-brain prevention!'
        : 'Quorum consensus dynamically adjusts to the new ensemble size.',
      confirmLabel: isDownscale ? 'Downscale ZooKeeper' : 'Scale ZooKeeper',
      isDestructive: isDownscale,
      onConfirm: () => {
        setZkReplicas(newCount);
        executePodScale('zookeeper', newCount);
      }
    });
  };

  // Handle MongoDB ReplicaSet Scale with Modal & Backend Execution
  const requestScaleMongoReplicaSet = (newCount: number) => {
    const isDownscale = newCount < mongoReplicas;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Downscaling MongoDB ReplicaSet' : 'Confirm Scaling MongoDB ReplicaSet (rs0)',
      actionType: 'scale_mongo',
      targetName: `MongoDB 8.0 ReplicaSet (rs0): ${mongoReplicas} → ${newCount} Nodes`,
      details: isDownscale 
        ? `Decommissioning 1 secondary replica. Quorum requires at least ${Math.floor(newCount / 2) + 1} votes out of ${newCount} members.`
        : `Deploying 1 new secondary member to rs0. It will automatically synchronize data via Oplog from Primary across physical nodes.`,
      warningText: isDownscale && (newCount < 3)
        ? 'DANGER: A MongoDB replica set should always maintain an odd number of voting members (minimum 3) to prevent split-brain!'
        : 'Quorum consensus dynamically adjusts to the new replica set size.',
      confirmLabel: isDownscale ? 'Downscale MongoDB' : 'Scale MongoDB Replica',
      isDestructive: isDownscale,
      onConfirm: () => {
        setMongoReplicas(newCount);
        executePodScale('mongo', newCount);
      }
    });
  };

  // Handle Flink Scale with Modal & Backend Execution
  const requestScaleFlink = (newCount: number) => {
    const isDownscale = newCount < flinkTaskManagers;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Downscaling Flink TaskManagers' : 'Confirm Extending Flink TaskManagers',
      actionType: 'scale_flink',
      targetName: `Flink TaskManagers: ${flinkTaskManagers} → ${newCount} Pods`,
      details: `Total available task slots will become ${newCount * 4} slots. Flink JobManager will dynamically register/deregister task executors.`,
      warningText: isDownscale && (newCount * 4 < 8)
        ? 'Active streaming jobs may fail or pause if available task slots drop below required job parallelism!'
        : undefined,
      confirmLabel: isDownscale ? 'Downscale TaskManagers' : 'Extend TaskManagers',
      isDestructive: isDownscale,
      onConfirm: () => {
        setFlinkTaskManagers(newCount);
        executePodScale('flink', newCount);
      }
    });
  };

  // Dynamically generated values.yaml
  const dynamicValuesYaml = useMemo(() => {
    return `# ==============================================================================
# CloudCluster Stack - Production Values Configuration (Full Auth Enforced)
# ==============================================================================
global:
  environment: "production"
  storageClass: "standard"
  imagePullPolicy: "IfNotPresent"
  s3:
    endpoint: "${s3Endpoint}"
    accessKey: "${minioUser}"
    secretKey: "${minioPassword}"
    region: "us-east-1"
    pathStyle: true
    ssl: false

minio:
  enabled: true
  replicas: ${minioReplicas}
  rootUser: "${minioUser}"
  rootPassword: "${minioPassword}"

flink:
  enabled: true
  image:
    repository: "flink"
    tag: "1.9.3-scala_2.12"
  jobManager:
    replicas: 1
  taskManager:
    replicas: ${flinkTaskManagers}
  auth:
    enabled: true
    adminUser: "${flinkAdminUser}"
    adminPassword: "${flinkAdminPassword}"

kafka:
  enabled: true
  image:
    repository: "apache/kafka"
    tag: "3.7.2"
  replicas: ${kafkaReplicas}
  kraft:
    enabled: ${useKraft}
    combinedRoles: true
  auth:
    enabled: true
    saslMechanism: "PLAIN"
    adminUser: "${kafkaAdminUser}"
    adminPassword: "${kafkaAdminPassword}"
    clientUser: "${kafkaAppUser}"
    clientPassword: "${kafkaAppPassword}"

mongodb:
  enabled: true
  mode: "replicaset"
  replicaSetName: "rs0"
  replicas: ${mongoReplicas}
  image:
    repository: "mongo"
    tag: "8.0.9"
  auth:
    enabled: true
    rootUser: "${mongoRootUser}"
    rootPassword: "${mongoRootPassword}"
    appUser: "${mongoAppUser}"
    appPassword: "${mongoAppPassword}"
  persistence:
    enabled: true
    size: "30Gi"
    storageClass: "local-storage"
  backupToS3:
    enabled: true
    schedule: "0 2 * * *"
    retentionCount: 3 # 严格仅保留最新 3 份数据 (滚动轮转)

mysql:
  enabled: true
  image:
    repository: "mysql"
    tag: "8.4.6"
  replicas: ${mysqlReplicas}
  rootPassword: "${mysqlRootPassword}"
  appUser: "${mysqlAppUser}"
  appPassword: "${mysqlAppPassword}"
  replicationUser: "repl_user"
  replicationPassword: "${mysqlReplPassword}"
  database: "appdb"
  backupToS3:
    enabled: true
    schedule: "0 3 * * *"
    retentionCount: 3 # 严格仅保留最新 3 份数据 (滚动轮转)

redis:
  enabled: true
  image:
    repository: "redis"
    tag: "6.2.6-alpine"
  replicas: ${redisReplicas}
  password: "${redisPassword}"

zookeeper:
  enabled: ${enableZookeeper}
  image:
    repository: "zookeeper"
    tag: "3.6.3"
  replicas: ${zkReplicas} # 3-member quorum
  auth:
    enabled: true
    adminUser: "${zkAdminUser}"
    adminPassword: "${zkAdminPassword}"
`;
  }, [
    flinkTaskManagers, kafkaReplicas, zkReplicas, mongoReplicas, mysqlReplicas, redisReplicas, minioReplicas,
    useKraft, enableZookeeper, s3Endpoint, minioUser, minioPassword, mysqlRootPassword, mysqlAppUser,
    mysqlAppPassword, mysqlReplPassword, mongoRootUser, mongoRootPassword, mongoAppUser, mongoAppPassword,
    redisPassword, kafkaAdminUser, kafkaAdminPassword, kafkaAppUser, kafkaAppPassword, zkAdminUser,
    zkAdminPassword, flinkAdminUser, flinkAdminPassword
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">CloudCluster K8s HA Control Suite</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HAProxy VIP: {vipIp}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3-Master HA K8s • ZooKeeper 3.6.3 • Kafka KRaft • Flink 1.9.3 • MongoDB 8.0.9 • MySQL 8.4.6 • Redis 6.2.6 • MinIO S3
              </p>
            </div>
          </div>

          {/* Execution & Simulator Mode Toggles */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {/* Backend Simulator Mode Toggle (Requested by user) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
              <span className="text-[11px] text-slate-400 pl-2">Backend Mode:</span>
              <button
                onClick={toggleSimulatorMode}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition flex items-center gap-1.5 shadow ${
                  isSimulatorMode
                    ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40'
                }`}
                title={isSimulatorMode ? "当前为模拟测试模式 (Dry-Run: 不实际修改系统与容器)" : "当前为宿主机真实执行模式 (Live: 命令直接在后端服务器执行并返回真实结果)"}
              >
                {isSimulatorMode ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-200 animate-pulse" />
                    🧪 Simulator (Dry-run)
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
                    ⚡ Real Host (Live)
                  </>
                )}
              </button>
            </div>

            {/* Pod Scaling Execution Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
              <span className="text-[11px] text-slate-400 pl-2">Scaler:</span>
              <button
                onClick={() => setExecutionMode('backend')}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition ${
                  executionMode === 'backend'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Directly executes via backend API on Kubernetes"
              >
                ⚡ Backend API
              </button>
              <button
                onClick={() => setExecutionMode('manual')}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition ${
                  executionMode === 'manual'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Generates Helm CLI command for terminal execution"
              >
                📋 Manual CLI
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6">
        <div className="max-w-7xl mx-auto flex overflow-x-auto gap-2 py-2">
          {[
            { id: 'k8s_nodes', label: '3-Master HA & Worker Nodes', icon: Server, badge: `${k8sNodes.length} Nodes` },
            { id: 'credentials', label: 'Auth & Initial Credentials (初始认证配置)', icon: Key, badge: 'All Secured' },
            { id: 'extensions', label: 'Cluster & Flink Extension Center', icon: Zap, badge: 'Scalable' },
            { id: 'k9s', label: 'K9s Terminal Monitor', icon: Terminal, badge: 'Live CLI' },
            { id: 'topology', label: 'Cluster Topology & Members', icon: Box },
            { id: 'storage', label: 'Storage & Persistence Deep-Dive', icon: HardDrive },
            { id: 'values', label: 'Helm Values Configurator', icon: Sliders },
            { id: 'runbook', label: 'Deployment Runbook (INSTALL.md)', icon: ArrowUpRight }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-blue-800 text-white' : 'bg-slate-800 text-cyan-300'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification Toast */}
      {provisioningMessage && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="bg-emerald-950/90 border border-emerald-500/40 p-4 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{provisioningMessage}</span>
            </div>
            <button onClick={() => setProvisioningMessage(null)} className="text-emerald-400 hover:text-white font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">

        {/* 1. K8S CLUSTER HA & WORKER PROVISIONING TAB */}
        {activeTab === 'k8s_nodes' && (
          <div className="space-y-6">
            {/* Top Architecture Overview Card: 3 Masters HA + Keepalived/HAProxy */}
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      High Availability Control Plane (Keepalived + HAProxy)
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Quorum Active (3/3)
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      The 3 master machines act as both <strong>control-plane masters</strong> and <strong>worker nodes</strong>. Keepalived provides a Virtual IP (VIP) fronted by HAProxy on port 6443.
                    </p>
                  </div>
                </div>

                {/* VIP / Domain Configuration Fields */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-300">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        高可用集群接入终端 (VIP / DOMAIN)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                        !/^[0-9.]+$/.test(editingVip.trim())
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                      }`}>
                        {!/^[0-9.]+$/.test(editingVip.trim()) ? '🌐 域名 FQDN 接入模式' : '⚡ 虚拟 IP (VIP) 模式'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingVip}
                        onChange={(e) => setEditingVip(e.target.value)}
                        placeholder="例如: 192.168.1.100 或 k8s-vip.internal.cloud"
                        className="bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-white font-bold text-xs focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="border-l border-slate-800 pl-3">
                      <span className="text-slate-400 block text-[10px]">PORT</span>
                      <input
                        type="number"
                        value={vipPort}
                        onChange={(e) => setVipPort(parseInt(e.target.value) || 6443)}
                        className="bg-transparent text-slate-200 focus:outline-none w-14 font-mono font-bold"
                      />
                    </div>
                    <div className="border-l border-slate-800 pl-3">
                      <span className="text-slate-400 block text-[10px]">INTERFACE</span>
                      <input
                        type="text"
                        value={netInterface}
                        onChange={(e) => setNetInterface(e.target.value)}
                        className="bg-transparent text-cyan-300 focus:outline-none w-16 font-mono"
                      />
                    </div>
                    <div className="border-l border-slate-800 pl-3 flex items-center">
                      <button
                        onClick={requestUpdateVip}
                        disabled={isUpdatingVip || editingVip.trim() === vipIp}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-sans flex items-center gap-1.5 transition whitespace-nowrap ${
                          editingVip.trim() !== vipIp
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 animate-pulse'
                            : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/60'
                        }`}
                        title={editingVip.trim() !== vipIp ? '点击弹出确认窗口以执行修改与服务重启' : '当前配置终端已保持同步'}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingVip ? 'animate-spin' : ''}`} />
                        {editingVip.trim() !== vipIp ? '保存修改 (触发确认)' : '终端已生效'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* VIP Update Feedback Banner */}
                {vipUpdateNotice && (
                  <div className="bg-emerald-950/90 border border-emerald-500/40 p-3 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
                    <span className="font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {vipUpdateNotice}
                    </span>
                    <button onClick={() => setVipUpdateNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
                  </div>
                )}
              </div>

              {/* Node Inventory Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    Active Node Inventory (Masters & Extension Workers)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Total: <strong className="text-white">{k8sNodes.length} Nodes</strong>
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">HOSTNAME</th>
                        <th className="p-3">IP ADDRESS</th>
                        <th className="p-3">SSH LOGIN</th>
                        <th className="p-3">INSTALL DIR</th>
                        <th className="p-3">ROLES</th>
                        <th className="p-3">KEEPALIVED</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 bg-slate-900/60">
                      {k8sNodes.map((node) => {
                        const isMaster = node.roles.includes('control-plane');
                        return (
                          <tr key={node.id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-bold text-white flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              {node.hostname}
                            </td>
                            <td className="p-3 text-cyan-300 font-semibold">{node.ip}</td>
                            <td className="p-3 text-slate-400">{node.sshUser}@{node.ip}:{node.sshPort}</td>
                            <td className="p-3 text-slate-400">{node.installDir}</td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {node.roles.map(r => (
                                  <span key={r} className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                                    r === 'control-plane' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                                    r === 'master' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                                    'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  }`}>
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                node.keepalivedRole === 'MASTER' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                node.keepalivedRole === 'BACKUP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'text-slate-600'
                              }`}>
                                {node.keepalivedRole}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="text-emerald-400 font-bold">{node.status}</span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => requestRemoveNode(node)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 border border-slate-700 text-xs font-sans transition flex items-center gap-1 ml-auto"
                                title="Drain & delete node (with confirmation modal)"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Extension Worker Node Provisioner Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="font-bold text-white text-base">Extend Cluster: Add New Worker Node</h3>
                    <p className="text-xs text-slate-400">
                      Input parameters here to generate the CLI script to run manually on the physical machine/VM.
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400">
                  Target Control Plane VIP: <strong className="text-cyan-300">{vipIp}:{vipPort}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Hostname */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Worker Hostname</label>
                  <input
                    type="text"
                    value={newWorkerHostname}
                    onChange={(e) => setNewWorkerHostname(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                    placeholder="k8s-worker-04"
                  />
                </div>

                {/* Machine IP */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Machine IP Address</label>
                  <input
                    type="text"
                    value={newWorkerIp}
                    onChange={(e) => setNewWorkerIp(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-cyan-300 font-mono"
                    placeholder="192.168.1.104"
                  />
                </div>

                {/* Install Position */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Installation Position / Directory</label>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2.5">
                    <Folder className="w-4 h-4 text-slate-500 mr-2" />
                    <input
                      type="text"
                      value={newWorkerInstallDir}
                      onChange={(e) => setNewWorkerInstallDir(e.target.value)}
                      className="w-full bg-transparent p-2 text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* SSH User */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">SSH Username</label>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2.5">
                    <User className="w-4 h-4 text-slate-500 mr-2" />
                    <input
                      type="text"
                      value={newWorkerSshUser}
                      onChange={(e) => setNewWorkerSshUser(e.target.value)}
                      className="w-full bg-transparent p-2 text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* SSH Port */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">SSH Port</label>
                  <input
                    type="number"
                    value={newWorkerSshPort}
                    onChange={(e) => setNewWorkerSshPort(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={requestAddWorkerNode}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition"
                >
                  <Terminal className="w-4 h-4" />
                  Generate Worker Join CLI (Requires Confirmation)
                </button>
              </div>
            </div>

            {/* External Git & Outbound Network Connectivity Tester Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      外部网络与 Git 连通性测试 (External Git Connectivity Hub)
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Git 2.34+ 物理机/Pod 出网就绪
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      宿主机与 Kubernetes Pod 原生支持访问外部公网 Git（GitHub / Gitee / GitLab），可直接克隆代码、Helm Charts 与微服务工程。
                    </p>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-[11px] text-slate-400">预设仓库:</span>
                  {[
                    { label: 'GitHub', url: 'https://github.com/torvalds/linux.git' },
                    { label: 'Gitee', url: 'https://gitee.com/oschina/git-osc.git' },
                    { label: 'GitLab', url: 'https://gitlab.com/gitlab-org/gitlab.git' }
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setGitTestUrl(p.url);
                        testGitConnectivity(p.url);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL Input Bar & Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400 shrink-0" />
                  <input
                    type="text"
                    value={gitTestUrl}
                    onChange={(e) => setGitTestUrl(e.target.value)}
                    placeholder="输入外部 Git 仓库地址 (https://github.com/...)"
                    className="w-full bg-transparent text-white font-mono text-xs focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => testGitConnectivity()}
                  disabled={gitTestLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition shrink-0"
                >
                  {gitTestLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>正在探查外部握手...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>测试 Git 连通性</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Test Feedback Banner */}
              {gitTestResult && (
                <div
                  className={`p-4 rounded-xl border text-xs font-mono space-y-1.5 transition ${
                    gitTestResult.accessible
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2">
                      {gitTestResult.accessible ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>✅ 外部 Git 仓库握手成功！(耗时: {gitTestResult.durationMs}ms)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>❌ 外部 Git 仓库连接失败</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400">git ls-remote HEAD</span>
                  </div>

                  {gitTestResult.output && (
                    <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800 truncate">
                      Remote Ref: {gitTestResult.output}
                    </div>
                  )}

                  {gitTestResult.error && (
                    <div className="text-[11px] text-rose-300 bg-slate-900/80 p-2 rounded border border-rose-900/60">
                      {gitTestResult.error}
                    </div>
                  )}

                  {gitTestResult.suggestion && (
                    <div className="text-[10px] text-slate-400 font-sans">
                      💡 提示：{gitTestResult.suggestion}
                    </div>
                  )}
                </div>
              )}

              {/* Tips & Commands Quick Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> 物理机秒级验证命令
                  </div>
                  <div className="text-[10px] text-slate-300 bg-slate-900 p-1.5 rounded truncate">
                    git ls-remote https://github.com/torvalds/linux.git HEAD
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> 国内机房 GitHub 加速前缀
                  </div>
                  <div className="text-[10px] text-amber-300 bg-slate-900 p-1.5 rounded truncate">
                    git clone https://ghproxy.net/https://github.com/...
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> 私有仓库 Token 克隆语法
                  </div>
                  <div className="text-[10px] text-emerald-300 bg-slate-900 p-1.5 rounded truncate">
                    git clone https://&lt;token&gt;@github.com/org/repo.git
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. AUTH & INITIAL CREDENTIALS VAULT TAB (ALL COMPONENTS ENFORCED AUTH) */}
        {activeTab === 'credentials' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Overview & Action Header */}
            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      集群初始安装与全服务统一认证凭证中心 (Credentials Vault)
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        8/8 服务全量强制认证
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      所有大数据与存储组件均已<strong>强制启用用户名/密码安全鉴权</strong>。在最开始执行集群安装前，您可以在此处统一审查、定制或一键生成高强度账号密码，所有变更与 Helm values.yaml 实时同步。
                    </p>
                  </div>
                </div>

                {/* Toolbar Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={generateAllRandomPasswords}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
                    title="一键为所有 8 大组件生成 16 位高强度随机密码"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    一键生成强密码
                  </button>
                  <button
                    onClick={() => setShowAllPasswords(!showAllPasswords)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    title={showAllPasswords ? "点击切换为密码隐藏模式" : "点击切换为密码明文显示模式"}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showAllPasswords ? '隐藏密码' : '明文显示'}
                  </button>
                  <button
                    onClick={saveCredentialsToServer}
                    disabled={isSavingCredentials}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                    title="保存并实时同步写入 credentials.env 与 helm/custom-credentials.yaml"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isSavingCredentials ? '正在同步...' : '保存并同步到宿主机'}
                  </button>
                  <button
                    onClick={copyAllCredentialsSheet}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    title="复制完整初始账号密码总表到剪贴板"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    复制凭证总表
                  </button>
                  <button
                    onClick={downloadCredentialsEnv}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    title="导出为 .env 环境变量文件"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出 credentials.env
                  </button>
                  <button
                    onClick={downloadCredentialsYaml}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                    title="导出为 YAML 凭证文件"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出 credentials.yaml
                  </button>
                  <button
                    onClick={resetDefaultCredentials}
                    className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 border border-slate-800 transition"
                    title="重置回初始默认凭证"
                  >
                    重置默认
                  </button>
                </div>
              </div>

              {/* Initial Install Command Quick Tip */}
              <div className="bg-slate-950/80 border border-indigo-500/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong className="text-white font-sans">物理机/VM 初始安装前初始化命令:</strong> <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">bash scripts/init-credentials.sh --generate</code>
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] font-sans">
                  生成文件后执行 <code className="text-amber-300 font-mono">./scripts/helm-install.sh</code> 将自动读取并注入强制认证凭证！
                </div>
              </div>

              {/* Security Highlights Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> 100% 拒绝匿名访问
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Kafka 启用 SASL_PLAINTEXT、Mongo 启用 Keyfile 鉴权、Redis 强制 requirepass、MySQL 强制 root/app 双密码。
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> 最小权限原则 (RBAC)
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    所有数据服务已内置超级管理员 (Root/Admin) 与应用程序专用读写账户 (App User)，避免应用直连 Root。
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> 双向实时同步 values.yaml
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    本页面修改的任何账号密码，将即时同步更新到 "Helm Values Configurator" 生成器中，直接用于一键部署。
                  </p>
                </div>
              </div>
            </div>

            {/* 8 Component Credentials Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* 1. MinIO S3 Object Storage */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">MinIO S3 对象存储</h3>
                      <p className="text-[10px] text-slate-400">S3 API (9000) • Web 控制台 (9001)</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                    AccessKey Auth
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Root User / AccessKey</label>
                    <input
                      type="text"
                      value={minioUser}
                      onChange={(e) => setMinioUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Root Password / SecretKey</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={minioPassword}
                      onChange={(e) => setMinioPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Web 控制台登录地址:</span>
                    <a href={`http://${vipIp}:9001`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
                      http://{vipIp}:9001 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">mc alias set myminio http://{vipIp}:9000 {minioUser} {minioPassword}</span>
                    <button onClick={() => copyToClipboard(`mc alias set myminio http://${vipIp}:9000 ${minioUser} ${minioPassword}`, 'mc-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. MySQL 8.4 Database */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">MySQL 8.4 LTS 关系数据库</h3>
                      <p className="text-[10px] text-slate-400">Port 3306 • GTID 主从复制 • 默认库 appdb</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                    Native Password
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Root 超级管理员密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={mysqlRootPassword}
                      onChange={(e) => setMysqlRootPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">业务应用账号 (App User)</label>
                    <input
                      type="text"
                      value={mysqlAppUser}
                      onChange={(e) => setMysqlAppUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">业务应用密码 (App Password)</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={mysqlAppPassword}
                      onChange={(e) => setMysqlAppPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">复制账号密码 (repl_user)</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={mysqlReplPassword}
                      onChange={(e) => setMysqlReplPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-semibold text-blue-300">通用微服务应用直连 JDBC 连接串:</span>
                    <span className="text-[10px] text-emerald-400 font-mono">100% 驱动兼容 (native_password)</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">jdbc:mysql://{vipIp}:3306/appdb?user={mysqlAppUser}&password={mysqlAppPassword}&useSSL=false&allowPublicKeyRetrieval=true</span>
                    <button onClick={() => copyToClipboard(`jdbc:mysql://${vipIp}:3306/appdb?user=${mysqlAppUser}&password=${mysqlAppPassword}&useSSL=false&allowPublicKeyRetrieval=true`, 'mysql-jdbc')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                    <span>Linux 客户端/终端直连命令:</span>
                    <span className="text-[10px] text-slate-500 font-mono">已授 '%' 全局主权</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-slate-300 flex items-center justify-between">
                    <span className="truncate">mysql -h {vipIp} -P 3306 -u {mysqlAppUser} -p'{mysqlAppPassword}' appdb</span>
                    <button onClick={() => copyToClipboard(`mysql -h ${vipIp} -P 3306 -u ${mysqlAppUser} -p'${mysqlAppPassword}' appdb`, 'mysql-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. MongoDB 8.0 ReplicaSet */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">MongoDB 8.0 副本集群 (rs0)</h3>
                      <p className="text-[10px] text-slate-400">Port 27017 • 3 物理机多副本 • 原生直连 + 跨库集中认证</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Dual-Ready Auth
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Root 管理员账号 (admin库)</label>
                    <input
                      type="text"
                      value={mongoRootUser}
                      onChange={(e) => setMongoRootUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Root 管理员密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={mongoRootPassword}
                      onChange={(e) => setMongoRootPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">应用业务账号 (appdb库)</label>
                    <input
                      type="text"
                      value={mongoAppUser}
                      onChange={(e) => setMongoAppUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">业务应用密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={mongoAppPassword}
                      onChange={(e) => setMongoAppPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Standard Direct App URI without authSource */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span className="font-semibold text-emerald-300">① 通用应用原生直连 (Spring Boot / Python / Mongoose 零侵入):</span>
                    <span className="text-[10px] text-emerald-400 font-mono">无需任何 extra 参数</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                    <span className="truncate">mongodb://{mongoAppUser}:{mongoAppPassword}@{vipIp}:27017/appdb?replicaSet=rs0</span>
                    <button onClick={() => copyToClipboard(`mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/appdb?replicaSet=rs0`, 'mongo-uri')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Multi-Database Universal Access with authSource=admin */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                    <span className="text-slate-400">② 多微服务跨库通用访问 (可访问任意数据库):</span>
                    <span className="text-[10px] text-cyan-400 font-mono">readWriteAnyDatabase</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">mongodb://{mongoAppUser}:{mongoAppPassword}@{vipIp}:27017/&lt;任意库&gt;?authSource=admin&replicaSet=rs0</span>
                    <button onClick={() => copyToClipboard(`mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/appdb?authSource=admin&replicaSet=rs0`, 'mongo-cross')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Redis 6.2 Sentinel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Redis 6.2 哨兵高可用集群</h3>
                      <p className="text-[10px] text-slate-400">Port 6379 • Sentinel 26379 • 强制 requirepass</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                    requirepass Auth
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">默认账号名称</label>
                    <input
                      type="text"
                      disabled
                      value="default"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Auth 认证密码 (Master + Sentinel)</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={redisPassword}
                      onChange={(e) => setRedisPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] text-slate-400">CLI 终端登录与 Ping 验证:</div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">redis-cli -h {vipIp} -p 6379 -a '{redisPassword}' ping</span>
                    <button onClick={() => copyToClipboard(`redis-cli -h ${vipIp} -p 6379 -a '${redisPassword}' ping`, 'redis-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Apache Kafka KRaft */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Apache Kafka 3.7 (KRaft)</h3>
                      <p className="text-[10px] text-slate-400">Port 9092 • SASL_PLAINTEXT 强制鉴权 • JAAS 配置</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                    SASL_PLAINTEXT
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Admin 运维管理员账号</label>
                    <input
                      type="text"
                      value={kafkaAdminUser}
                      onChange={(e) => setKafkaAdminUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Admin 管理员密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={kafkaAdminPassword}
                      onChange={(e) => setKafkaAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Client 生产/消费账号 (app_user)</label>
                    <input
                      type="text"
                      value={kafkaAppUser}
                      onChange={(e) => setKafkaAppUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Client 密码 (app_password)</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={kafkaAppPassword}
                      onChange={(e) => setKafkaAppPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-emerald-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] text-slate-400">客户端 client.properties 配置行:</div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">security.protocol=SASL_PLAINTEXT; sasl.jaas.config=...PlainLoginModule username="{kafkaAppUser}" password="{kafkaAppPassword}"</span>
                    <button onClick={() => copyToClipboard(`security.protocol=SASL_PLAINTEXT\nsasl.mechanism=PLAIN\nsasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="${kafkaAppUser}" password="${kafkaAppPassword}";\nbootstrap.servers=${vipIp}:9092`, 'kafka-props')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 6. Apache ZooKeeper */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Apache ZooKeeper 3.6.3</h3>
                      <p className="text-[10px] text-slate-400">Port 2181 • 3-Node Quorum • SASL / Digest 鉴权</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    SASL Digest
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">ZK Admin 管理账号</label>
                    <input
                      type="text"
                      value={zkAdminUser}
                      onChange={(e) => setZkAdminUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">ZK Admin 认证密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={zkAdminPassword}
                      onChange={(e) => setZkAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] text-slate-400">客户端连接与 Digest Auth 命令:</div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">addauth digest {zkAdminUser}:{zkAdminPassword}</span>
                    <button onClick={() => copyToClipboard(`addauth digest ${zkAdminUser}:${zkAdminPassword}`, 'zk-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 7. Apache Flink */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Apache Flink 1.9.3 控制台</h3>
                      <p className="text-[10px] text-slate-400">Port 8081 • Web Dashboard & REST API BasicAuth</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
                    HTTP Basic Auth
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Dashboard 登录账号</label>
                    <input
                      type="text"
                      value={flinkAdminUser}
                      onChange={(e) => setFlinkAdminUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Dashboard 登录密码</label>
                    <input
                      type={showAllPasswords ? "text" : "password"}
                      value={flinkAdminPassword}
                      onChange={(e) => setFlinkAdminPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Web 仪表盘访问入口:</span>
                    <a href={`http://${vipIp}:8081`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
                      http://{vipIp}:8081 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">curl -u {flinkAdminUser}:{flinkAdminPassword} http://{vipIp}:8081/jobs/overview</span>
                    <button onClick={() => copyToClipboard(`curl -u ${flinkAdminUser}:${flinkAdminPassword} http://${vipIp}:8081/jobs/overview`, 'flink-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 8. Kubernetes Control Plane */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Kubernetes VIP 控制面网关</h3>
                      <p className="text-[10px] text-slate-400">Keepalived + HAProxy • API Server :6443</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                    mTLS + Bearer
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Master 账号 / Context</label>
                    <input
                      type="text"
                      disabled
                      value="kubernetes-admin"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Worker Join Token</label>
                    <input
                      type="text"
                      disabled
                      value="abcdef.0123456789abcdef"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2 text-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="text-[10px] text-slate-400">集群管理与节点就绪探查 CLI:</div>
                  <div className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center justify-between">
                    <span className="truncate">kubectl --server=https://{vipIp}:{vipPort} get nodes -o wide</span>
                    <button onClick={() => copyToClipboard(`kubectl --server=https://${vipIp}:${vipPort} get nodes -o wide`, 'k8s-cmd')} className="text-slate-400 hover:text-white ml-2">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Universal Multi-App Connection Hub & Framework Code Generator */}
            <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <Code className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      其他应用程序与微服务通用接入生成器 (Universal Multi-App Hub)
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        100% 通用无阻碍
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      解答“应用程序登录是否通用”疑问：Spring Boot、Python、Node.js、Go 开箱即连。已支持原生业务库直连与跨库全局访问。
                    </p>
                  </div>
                </div>

                {/* Target Database Input */}
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 pl-2">目标微服务业务库名:</span>
                  <input
                    type="text"
                    value={customTargetDb}
                    onChange={(e) => setCustomTargetDb(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono font-bold w-36 focus:outline-none focus:border-blue-500"
                    placeholder="appdb"
                  />
                </div>
              </div>

              {/* Language / Framework Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'spring', label: '☕ Java (Spring Boot)' },
                    { id: 'zookeeper', label: '🦁 Gateway + ZooKeeper 微服务' },
                    { id: 'python', label: '🐍 Python (PyMongo & SQLAlchemy)' },
                    { id: 'nodejs', label: '🟢 Node.js (Mongoose & TypeORM)' },
                    { id: 'go', label: '🐹 Go (mongo-driver & GORM)' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAppLang(item.id as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                        selectedAppLang === item.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                  {selectedAppLang === 'zookeeper' ? '✅ ZooKeeper 2181 原生注册发现' : '✅ 零侵入: 不需要传 --authenticationDatabase'}
                </span>
              </div>

              {/* Framework Specific Code Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Left Card: MongoDB or Gateway API Entry */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      {selectedAppLang === 'zookeeper' ? (
                        <>
                          <Server className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-cyan-400">1. Spring Cloud Gateway (网关入口与服务路由)</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5" /> MongoDB 8.0 副本集群配置
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        const code = selectedAppLang === 'zookeeper'
                          ? `server:\n  port: 8080\nspring:\n  cloud:\n    zookeeper:\n      connect-string: ${vipIp}:2181 # 集群内使用 zookeeper:2181\n      discovery:\n        enabled: true\n    gateway:\n      discovery:\n        locator:\n          enabled: true\n          lower-case-service-id: true\n      routes:\n        - id: microservice-route\n          uri: lb://auth-service # 自动路由到注册在 ZooKeeper 的子服务\n          predicates:\n            - Path=/api/auth/**`
                          : selectedAppLang === 'spring'
                          ? `spring:\n  data:\n    mongodb:\n      uri: mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0`
                          : selectedAppLang === 'python'
                          ? `from pymongo import MongoClient\nclient = MongoClient("mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0")\ndb = client["${customTargetDb}"]`
                          : selectedAppLang === 'nodejs'
                          ? `const mongoose = require('mongoose');\nawait mongoose.connect('mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0');`
                          : `client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0"))`;
                        copyToClipboard(code, 'mongo-app-code');
                      }}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> 复制代码
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/60 rounded-lg">
                    {selectedAppLang === 'zookeeper' && (
`# gateway/src/main/resources/application.yml
server:
  port: 8080
spring:
  application:
    name: api-gateway
  cloud:
    zookeeper:
      connect-string: zookeeper:2181 # 外部访问用 ${vipIp}:2181
      discovery:
        enabled: true
    gateway:
      discovery:
        locator:
          enabled: true
          lower-case-service-id: true
      routes:
        - id: sub-services
          uri: lb://my-service # 从 ZooKeeper 动态负载均衡
          predicates:
            - Path=/api/service/**`
                    )}
                    {selectedAppLang === 'spring' && (
`# application.yml
spring:
  data:
    mongodb:
      # 驱动自动以 ${customTargetDb} 为认证源，无需额外 authSource 参数！
      uri: mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0`
                    )}
                    {selectedAppLang === 'python' && (
`# Python PyMongo
from pymongo import MongoClient

# 原生直连，开箱即用：
client = MongoClient("mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0")
db = client["${customTargetDb}"]
collection = db["users"]`
                    )}
                    {selectedAppLang === 'nodejs' && (
`// Node.js (Mongoose / MongoDB Driver)
const mongoose = require('mongoose');

// 标准原生连接，不依赖任何 CLI 额外标志：
await mongoose.connect('mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0', {
  autoIndex: true
});`
                    )}
                    {selectedAppLang === 'go' && (
`// Go Official mongo-driver
package main

import (
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

uri := "mongodb://${mongoAppUser}:${mongoAppPassword}@${vipIp}:27017/${customTargetDb}?replicaSet=rs0"
client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))`
                    )}
                  </pre>
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    {selectedAppLang === 'zookeeper' ? (
                      <>
                        💡 <strong>Gateway 说明</strong>：Gateway 充当统一 API 入口（外部通过 VIP <code className="text-cyan-400">{vipIp}:8080</code> 访问），从本集群 3 节点 ZooKeeper 中动态拉取子服务列表，实现零侵入动态转发。
                      </>
                    ) : (
                      <>
                        💡 <strong>原理说明</strong>：MongoDB 驱动将 URI 路径中的 <code className="text-emerald-400">/{customTargetDb}</code> 作为默认认证数据库。我们在集群初始化中已直接将用户注册在该业务库中，因此无论任何编程语言，均按最通用的 MongoDB 标准 URI 连接即可，<strong>完全不需要传递 <code className="text-slate-400">--authenticationDatabase admin</code></strong>！
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Right Card: MySQL Application Connection or Microservice ZK Config */}
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      {selectedAppLang === 'zookeeper' ? (
                        <>
                          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-indigo-400">2. 各子微服务配置 (注册 ZK + 数据库)</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5" /> MySQL 8.4 LTS 关系数据库配置
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => {
                        const code = selectedAppLang === 'zookeeper'
                          ? `spring:\n  application:\n    name: auth-service # 与 pom.xml 中 git-commit-id-plugin 一致\n  cloud:\n    zookeeper:\n      connect-string: ${vipIp}:2181\n      discovery:\n        enabled: true\n        prefer-ip-address: true # 使用 K8s Pod IP 注册\n  datasource:\n    url: jdbc:mysql://${vipIp}:3306/${customTargetDb}?useSSL=false&allowPublicKeyRetrieval=true\n    username: ${mysqlAppUser}\n    password: ${mysqlAppPassword}`
                          : selectedAppLang === 'spring'
                          ? `spring:\n  datasource:\n    url: jdbc:mysql://${vipIp}:3306/${customTargetDb}?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC\n    username: ${mysqlAppUser}\n    password: ${mysqlAppPassword}\n    driver-class-name: com.mysql.cj.jdbc.Driver`
                          : selectedAppLang === 'python'
                          ? `from sqlalchemy import create_engine\nengine = create_engine("mysql+pymysql://${mysqlAppUser}:${mysqlAppPassword}@${vipIp}:3306/${customTargetDb}")`
                          : selectedAppLang === 'nodejs'
                          ? `// TypeORM or Prisma DATABASE_URL\nDATABASE_URL="mysql://${mysqlAppUser}:${mysqlAppPassword}@${vipIp}:3306/${customTargetDb}"`
                          : `import "gorm.io/driver/mysql"\ndsn := "${mysqlAppUser}:${mysqlAppPassword}@tcp(${vipIp}:3306)/${customTargetDb}?charset=utf8mb4&parseTime=True&loc=Local"\ndb, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})`;
                        copyToClipboard(code, 'mysql-app-code');
                      }}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> 复制代码
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-slate-900/60 rounded-lg">
                    {selectedAppLang === 'zookeeper' && (
`# 子微服务 (带有 git-commit-id-plugin) application.yml
spring:
  application:
    name: auth-service
  cloud:
    zookeeper:
      connect-string: zookeeper:2181 # 集群内直连
      discovery:
        prefer-ip-address: true      # 关键: 用 Pod IP 跨节点通信
  datasource:
    url: jdbc:mysql://mysql:3306/${customTargetDb}?useSSL=false&allowPublicKeyRetrieval=true
    username: ${mysqlAppUser}
    password: \${MYSQL_PASSWORD:${mysqlAppPassword}}`
                    )}
                    {selectedAppLang === 'spring' && (
`# application.yml
spring:
  datasource:
    url: jdbc:mysql://${vipIp}:3306/${customTargetDb}?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: ${mysqlAppUser}
    password: ${mysqlAppPassword}
    driver-class-name: com.mysql.cj.jdbc.Driver`
                    )}
                    {selectedAppLang === 'python' && (
`# Python (SQLAlchemy / PyMySQL)
from sqlalchemy import create_engine

# 通配主机 '%' 与 native_password 保证连接畅通：
engine = create_engine("mysql+pymysql://${mysqlAppUser}:${mysqlAppPassword}@${vipIp}:3306/${customTargetDb}")`
                    )}
                    {selectedAppLang === 'nodejs' && (
`// .env for Prisma / TypeORM / Sequelize
DATABASE_URL="mysql://${mysqlAppUser}:${mysqlAppPassword}@${vipIp}:3306/${customTargetDb}?connection_limit=10"
MYSQL_HOST="${vipIp}"
MYSQL_PORT="3306"
MYSQL_USER="${mysqlAppUser}"
MYSQL_PASSWORD="${mysqlAppPassword}"`
                    )}
                    {selectedAppLang === 'go' && (
`// Go GORM
import (
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
)

dsn := "${mysqlAppUser}:${mysqlAppPassword}@tcp(${vipIp}:3306)/${customTargetDb}?charset=utf8mb4&parseTime=True&loc=Local"
db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})`
                    )}
                  </pre>
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    {selectedAppLang === 'zookeeper' ? (
                      <>
                        💡 <strong>子微服务说明</strong>：子模块设置 <code className="text-indigo-400">prefer-ip-address: true</code> 后，会自动将容器 Pod IP 上报给 ZooKeeper，Gateway 与其他微服务即可通过 ZooKeeper 瞬时发现并进行负载均衡调用。
                      </>
                    ) : (
                      <>
                        💡 <strong>原理说明</strong>：MySQL 初始化时已执行 <code className="text-blue-300">GRANT ALL ON *.* TO '{mysqlAppUser}'@'%'</code>，主机限定为 <code className="text-blue-300">%</code>。无论您的微服务位于 K8s 内部 Pod 网段（10.244.x.x）还是外部物理机网络，均可畅通访问，并可自由操作或新建任意微服务数据库。
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Fast 1-Click Provisioning for Strictly Isolated Third-party Services */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> 想要为全新微服务创建【物理隔离】的独立专属账号与数据库？
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans">若不想共用 app_user，可复制下方单行命令 1 秒新建：</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>MySQL 1-Click 隔离建库与建账号:</span>
                      <button onClick={() => copyToClipboard(`mysql -h ${vipIp} -P 3306 -u root -p'${mysqlRootPassword}' -e "CREATE DATABASE IF NOT EXISTS ${customTargetDb}; CREATE USER '${customTargetDb}_user'@'%' IDENTIFIED WITH mysql_native_password BY '${mysqlAppPassword}'; GRANT ALL ON ${customTargetDb}.* TO '${customTargetDb}_user'@'%'; FLUSH PRIVILEGES;"`, 'mysql-iso')} className="text-slate-400 hover:text-white">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-amber-300 text-[10px] truncate">
                      mysql -h {vipIp} -u root -p'...' -e "CREATE DATABASE {customTargetDb}; CREATE USER '{customTargetDb}_user'@'%' ...;"
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>MongoDB 1-Click 独立原生账号创建:</span>
                      <button onClick={() => copyToClipboard(`mongosh "mongodb://${vipIp}:27017/admin?replicaSet=rs0" -u ${mongoRootUser} -p'${mongoRootPassword}' --eval "db.getSiblingDB('${customTargetDb}').createUser({user: '${customTargetDb}_user', pwd: '${mongoAppPassword}', roles: [{role: 'readWrite', db: '${customTargetDb}'}]});"`, 'mongo-iso')} className="text-slate-400 hover:text-white">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-emerald-300 text-[10px] truncate">
                      mongosh "mongodb://{vipIp}:27017/admin?replicaSet=rs0" -u admin -p'...' --eval "db.getSiblingDB('{customTargetDb}').createUser(...);"
                    </div>
                  </div>
                </div>
              </div>

              {/* How Microservices Automatically Obtain the Password (4 Standard Patterns) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    所有微服务共用同一套密码时，微服务如何“知道”密码并自动登录？(4 大标准分发姿势)
                  </h4>
                  <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    免硬编码最佳实践
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Pattern 1 */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 1. K8s Secret 自动注入
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      若微服务在 K8s 内部，Pod 直接引用 <code className="text-emerald-300">mongodb-auth</code> 与 <code className="text-blue-300">mysql-credentials</code> Secret，密码由集群自动注入环境变量，<strong>代码完全无需写死密码</strong>。
                    </p>
                  </div>

                  {/* Pattern 2 */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> 2. 配置中心集中分发
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      在 <strong>Nacos / Apollo / Spring Cloud Config</strong> 的共享组 <code className="text-cyan-300">common.yaml</code> 中写入一次，全量数十个微服务启动时自动继承生效。
                    </p>
                  </div>

                  {/* Pattern 3 */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="text-amber-400 font-bold flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> 3. 环境变量文件挂载
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      独立容器或物理机微服务，直接挂载根目录导出的 <code className="text-amber-300">credentials.env</code>（如 <code className="text-slate-300">--env-file credentials.env</code>），开箱即读。
                    </p>
                  </div>

                  {/* Pattern 4 */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="text-purple-400 font-bold flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> 4. CI/CD API 自动拉取
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      自动化流水线只需执行 <code className="text-purple-300">curl http://{vipIp}:3000/api/credentials</code>，即可获取 JSON 全量实时密码，无缝注入流水线。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'extensions' && (
          <div className="space-y-6">
            {/* Flink Cockpit */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      Apache Flink 1.9.3 JobManager & TaskManager Scaler
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {executionMode === 'backend' ? '⚡ Backend Direct Mode Active' : '📋 Manual CLI Mode Active'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Scale TaskManagers dynamically with safety confirmation modal.
                    </p>
                  </div>
                </div>

                {/* TaskManager Live Scaler with Confirmation */}
                <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-300 font-medium">Extend TaskManagers:</span>
                  <button
                    onClick={() => requestScaleFlink(Math.max(1, flinkTaskManagers - 1))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    title="Scale down 1 TaskManager (Requires Confirm)"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold font-mono text-amber-400 px-2">{flinkTaskManagers} Pods</span>
                  <button
                    onClick={() => requestScaleFlink(flinkTaskManagers + 1)}
                    className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition shadow-sm"
                    title="Scale up 1 TaskManager (Requires Confirm)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Flink Metrics Summary Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total Task Slots</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{flinkTaskManagers * 4} Slots</div>
                  <div className="text-[10px] text-slate-500">4 slots per TaskManager</div>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Slots Used / Available</div>
                  <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">
                    {flinkJobs.reduce((s, j) => s + j.slots, 0)} / {Math.max(0, flinkTaskManagers * 4 - flinkJobs.reduce((s, j) => s + j.slots, 0))}
                  </div>
                  <div className="text-[10px] text-slate-500">{flinkJobs.length} active streaming job (Metrics Aggregator)</div>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">S3 State Backend</div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-1 truncate">s3://flink-checkpoints</div>
                  <div className="text-[10px] text-slate-500">MinIO S3 Plugin Enabled</div>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Java Runtime</div>
                  <div className="text-sm font-bold font-mono text-purple-300 mt-1">OpenJDK 8 (Java 1.8)</div>
                  <div className="text-[10px] text-slate-500">Native compatibility</div>
                </div>
              </div>

              {/* Active Flink Streaming Jobs Section */}
              <div className="space-y-3 pt-2">
                {checkpointNotice && (
                  <div className="bg-emerald-950/90 border border-emerald-500/40 p-3.5 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-lg">
                    <span className="font-mono">{checkpointNotice}</span>
                    <button onClick={() => setCheckpointNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                      Active Flink Streaming Jobs (实时流式计算任务)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      实时拉取 Kafka Topic 消息流，统计吞吐量与 Consumer Group LAG，点击即可图形化呈现。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMetricsGraphModal(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <BarChart3 className="w-4 h-4" /> 查看 Topic 吞吐与 LAG 图形
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Job ID</th>
                        <th className="p-3">Job Name & 监控维度</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Parallelism</th>
                        <th className="p-3">S3 Checkpoint Target</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 bg-slate-900/60">
                      {flinkJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 text-amber-400 font-bold">{job.id}</td>
                          <td className="p-3 max-w-sm">
                            <div className="text-white font-medium text-xs flex items-center gap-2">
                              {job.name}
                              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px]">
                                图形监控已就绪
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans mt-0.5 leading-relaxed">{job.roleDescription}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                                4 Topics (user-activity, orders, iot, audit)
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                                总速率: 10,930 msgs/s
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                                当前总 LAG: 597 msgs
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px]">
                              {job.status}
                            </span>
                          </td>
                          <td className="p-3">{job.parallelism} slots</td>
                          <td className="p-3 text-cyan-300 truncate max-w-xs">{job.checkpointLocation}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setShowMetricsGraphModal(true)}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold flex items-center gap-1 transition shadow whitespace-nowrap"
                              >
                                <BarChart3 className="w-3.5 h-3.5" /> 查看图形
                              </button>
                              <button
                                onClick={() => handleTriggerCheckpoint(job.id)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-xs font-sans transition whitespace-nowrap"
                              >
                                Checkpoint
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Helm TaskManager CLI scaling tip */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="text-slate-400 truncate">
                    <span className="text-slate-500"># Direct CLI to scale Flink TaskManagers:</span>
                    <div className="text-amber-300 mt-0.5">
                      helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set flink.taskManager.replicas={flinkTaskManagers}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set flink.taskManager.replicas=${flinkTaskManagers}`, 'cli-flink')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0 ml-3"
                  >
                    {copiedId === 'cli-flink' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Direct Kafka-To-MinIO S3 Connector (No Flink Required) */}
              <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">Kafka-To-MinIO-S3-Streaming-Sink (Direct Pipeline)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          无需 Flink 引擎 • 0 槽位开销
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        基于 Kafka Connect S3 Sink 原生连接器，直连 MinIO S3 做冷数据持久化与湖仓归档。
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowKafkaS3Modal(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white border border-slate-700 text-xs font-mono transition flex items-center gap-1.5"
                  >
                    <Code className="w-3.5 h-3.5" /> View Connector JSON
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Source Topics:</span>
                    <div className="text-slate-200 truncate">iot-telemetry, user-activity, orders</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Destination:</span>
                    <div className="text-emerald-400 truncate">s3://flink-checkpoints/data/</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Format & Partition:</span>
                    <div className="text-purple-300 truncate">JSON / Parquet (Hourly TimeBased)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster Stateful Member Extension with Confirmation */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                Cluster Stateful Nodes Scaling (Protected with Confirmation Modal)
              </h2>
              <p className="text-xs text-slate-400">
                Adding or removing cluster members triggers safety checks on quorum and consensus before execution.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Kafka KRaft Node Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-purple-300 flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> Kafka KRaft Nodes
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-xs border border-purple-800">
                      {kafkaReplicas} Nodes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => requestScaleKafka(Math.max(3, kafkaReplicas - 2))}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                    >
                      -2 Nodes
                    </button>
                    <button
                      onClick={() => requestScaleKafka(kafkaReplicas + 2)}
                      className="flex-1 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                    >
                      +2 Nodes
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    KRaft Quorum: <span className="text-slate-200">{Math.floor(kafkaReplicas / 2) + 1} of {kafkaReplicas} votes</span>
                  </div>
                </div>

                {/* ZooKeeper 3.6.3 Ensemble Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-cyan-300 flex items-center gap-2">
                      <Server className="w-4 h-4" /> ZooKeeper 3.6.3
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-xs border border-cyan-800">
                      {zkReplicas} Nodes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => requestScaleZooKeeper(Math.max(3, zkReplicas - 2))}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                    >
                      -2 Nodes
                    </button>
                    <button
                      onClick={() => requestScaleZooKeeper(zkReplicas + 2)}
                      className="flex-1 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                    >
                      +2 Nodes
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ZK Quorum: <span className="text-slate-200">{Math.floor(zkReplicas / 2) + 1} of {zkReplicas} votes (Java 8)</span>
                  </div>
                </div>

                {/* MongoDB 8.0 ReplicaSet Cluster Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-emerald-300 flex items-center gap-2">
                      <Database className="w-4 h-4" /> Mongo 副本集群 (rs0)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-800">
                      {mongoReplicas} Nodes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => requestScaleMongoReplicaSet(Math.max(3, mongoReplicas - 1))}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                      title="Decommission 1 secondary replica"
                    >
                      -1 Replica
                    </button>
                    <button
                      onClick={() => requestScaleMongoReplicaSet(mongoReplicas + 1)}
                      className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      title="Deploy & join 1 new secondary replica"
                    >
                      +1 Replica
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    架构: <span className="text-slate-200">1 Primary + {mongoReplicas - 1} Secondaries • Quorum: {Math.floor(mongoReplicas / 2) + 1}/{mongoReplicas}</span>
                  </div>
                </div>

                {/* MySQL Replicas Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-blue-300 flex items-center gap-2">
                      <Database className="w-4 h-4" /> MySQL GTID Replicas
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono text-xs border border-blue-800">
                      {mysqlReplicas} Replicas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        triggerConfirmation({
                          title: 'Confirm Removing MySQL Replica',
                          actionType: 'scale_mysql',
                          targetName: `MySQL: ${mysqlReplicas} → ${mysqlReplicas - 1} Pods`,
                          details: 'One read replica will be detached and deleted. Primary mysql-0 is unaffected.',
                          confirmLabel: 'Remove Replica',
                          isDestructive: true,
                          onConfirm: () => {
                            setMysqlReplicas(Math.max(2, mysqlReplicas - 1));
                            executePodScale('mysql', Math.max(2, mysqlReplicas - 1));
                          }
                        });
                      }}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                    >
                      -1 Replica
                    </button>
                    <button
                      onClick={() => {
                        triggerConfirmation({
                          title: 'Confirm Adding MySQL Read Replica',
                          actionType: 'scale_mysql',
                          targetName: `MySQL: ${mysqlReplicas} → ${mysqlReplicas + 1} Pods`,
                          details: 'A new read replica mysql-N will join the GTID replication pool from primary mysql-0.',
                          confirmLabel: 'Add Replica',
                          isDestructive: false,
                          onConfirm: () => {
                            setMysqlReplicas(mysqlReplicas + 1);
                            executePodScale('mysql', mysqlReplicas + 1);
                          }
                        });
                      }}
                      className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                    >
                      +1 Replica
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Topology: <span className="text-slate-200">1 Master + {mysqlReplicas - 1} Read Replicas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. K9S TERMINAL MONITOR */}
        {activeTab === 'k9s' && (
          <div className="space-y-6">
            <div className="bg-black border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-mono">
              <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-yellow-400 flex items-center gap-1">
                    🐶 K9s <span className="text-[10px] text-slate-400 font-normal">v0.32.4</span>
                  </span>
                  <span>Context: <span className="text-cyan-300">k8s-cluster</span></span>
                  <span>Namespace: <span className="text-emerald-400 font-bold">data-platform</span></span>
                </div>
              </div>
              <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-1.5 max-h-[400px] overflow-auto">
                <div className="text-yellow-400">--- Kubernetes Cluster Node Pod Allocation ---</div>
                <div className="text-emerald-400">k8s-master-01 (192.168.1.101): [control-plane, worker] → minio-0, kafka-0, zookeeper-0, mongodb-0 (Primary, rs0), mysql-0 (Primary), flink-jobmanager</div>
                <div className="text-cyan-300">k8s-master-02 (192.168.1.102): [control-plane, worker] → minio-1, kafka-1, zookeeper-1, mongodb-1 (Secondary, rs0), mysql-1 (Replica), flink-taskmanager-0</div>
                <div className="text-purple-300">k8s-master-03 (192.168.1.103): [control-plane, worker] → minio-2, kafka-2, zookeeper-2, mongodb-2 (Secondary, rs0), mysql-2 (Replica), flink-taskmanager-1</div>
                {k8sNodes.length > 3 && (
                  <div className="text-amber-300">Extension Workers: {k8sNodes.slice(3).map(n => `${n.hostname} (${n.ip})`).join(', ')} → Additional Flink TMs & Worker Workloads</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. TOPOLOGY VIEW */}
        {activeTab === 'topology' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Box className="w-5 h-5 text-blue-400" />
                Cluster Topology Overview (7 Distributed Components)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30">
                  <div className="text-cyan-400 font-bold text-sm">MinIO Distributed S3</div>
                  <div className="text-slate-300 mt-1">{minioReplicas} Pods • Erasure Coding</div>
                  <div className="text-slate-500 text-[10px] mt-1">Central S3 Hub (:9000/:9001)</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30">
                  <div className="text-amber-400 font-bold text-sm">Flink 1.9.3 (Java 8)</div>
                  <div className="text-slate-300 mt-1">1 JM + {flinkTaskManagers} TaskManagers</div>
                  <div className="text-slate-500 text-[10px] mt-1">{flinkTaskManagers * 4} Total Slots (s3-fs-hadoop)</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/30">
                  <div className="text-purple-400 font-bold text-sm">Kafka KRaft</div>
                  <div className="text-slate-300 mt-1">{kafkaReplicas} Members (Combined Roles)</div>
                  <div className="text-slate-500 text-[10px] mt-1">Java 8 Compatible • No ZK Req</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30">
                  <div className="text-cyan-300 font-bold text-sm">ZooKeeper 3.6.3</div>
                  <div className="text-slate-300 mt-1">{zkReplicas} Nodes Ensemble (Java 8)</div>
                  <div className="text-slate-500 text-[10px] mt-1">Quorum Ensemble (:2181/:2888/:3888)</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
                  <div className="text-emerald-400 font-bold text-sm">MongoDB 8.0.9 (副本集群)</div>
                  <div className="text-slate-300 mt-1">{mongoReplicas} Nodes ReplicaSet (rs0)</div>
                  <div className="text-slate-500 text-[10px] mt-1">1 Primary + {mongoReplicas - 1} Secondaries • S3 冷备份</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/30">
                  <div className="text-blue-400 font-bold text-sm">MySQL 8.4.6 LTS</div>
                  <div className="text-slate-300 mt-1">{mysqlReplicas} Pods (GTID Replicas)</div>
                  <div className="text-slate-500 text-[10px] mt-1">1 Primary + {mysqlReplicas - 1} Read Replicas</div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30">
                  <div className="text-rose-400 font-bold text-sm">Redis 6.2.6</div>
                  <div className="text-slate-300 mt-1">{redisReplicas} Nodes + Sentinel HA</div>
                  <div className="text-slate-500 text-[10px] mt-1">Sentinel Quorum 2 (:6379/:26379)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. STORAGE & PERSISTENCE */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            {/* Header / Q&A Core Verdict */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      3 台物理主机下 MySQL & MongoDB 持久化存储架构指南
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Storage Best Practices
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      针对“3台物理机数据放在哪台都不合适、能否直接挂载 S3 对象存储”的深度解答与落地方案
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-400">当前集群拓扑:</span>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-emerald-400 font-bold">
                    3 Master/Worker 物理机
                  </span>
                </div>
              </div>

              {/* Direct Verdict Alert */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    ❌ 核心结论：直接挂载 S3 放 MySQL/Mongo 原生数据盘——不可行！
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    S3 是<strong>对象存储 (Object Storage)</strong>，仅支持全量 Put/Get，不提供 POSIX 文件系统的原子字节锁 (byte-range lock)、原子扇区写入与 <code className="text-rose-300">fsync()</code> 刷盘保证。若通过 s3fs 挂载直接运行数据库：
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>每次 16KB 页更新需全量重新上传，写入延迟从本地 &lt;0.5ms 暴增至 300~1000ms+；</li>
                    <li>S3 缺乏分布式文件租约控制，节点漂移或并发极易造成<strong>数据库死锁与表空间损坏</strong>。</li>
                  </ul>
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ✅ S3 的真正杀手级定位：实时快照、Binlog 归档与异地灾备 (PITR)
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    S3 是数据库<strong>冷热数据分离的完美载体</strong>！生产最佳架构是：<strong>数据库日常读写依托物理机本地高速盘，旁路服务实时/定时将全量快照与增量日志推送到 S3/MinIO</strong>：
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                    <li>MySQL XtraBackup / Binlog 实时流式推送到 S3，支持任意秒级时间点恢复 (PITR)；</li>
                    <li>MongoDB Oplog 持续归档至 MinIO 桶，即使 3 台机器全部损坏也可从 S3 瞬时重建。</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 3 Production Architectural Solutions Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    3 台物理机环境下落地数据库持久化的 3 大权威方案
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">点击切换查看各方案的架构设计、容灾能力与配置文件模板</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setStorageSolutionTab('s3_hybrid')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      storageSolutionTab === 's3_hybrid'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                    方案 3: 本地盘 + MySQL/Mongo S3冷备份 (当前生效)
                  </button>
                  <button
                    onClick={() => setStorageSolutionTab('replica')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                      storageSolutionTab === 'replica'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    方案 1: 仅本地原生副本
                  </button>
                  <button
                    onClick={() => setStorageSolutionTab('distributed')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition ${
                      storageSolutionTab === 'distributed'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    方案 2: 分布式块存储 (Longhorn)
                  </button>
                </div>
              </div>

              {/* Solution A: Native ReplicaSet (Recommended) */}
              {storageSolutionTab === 'replica' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px]">
                          工程默认首选
                        </span>
                        方案 A：应用层原生多副本高可用 + 本地高速盘 (Local PV / HostPath)
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400">IOPS: 100,000+ | 延时: &lt;0.2ms</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>核心原理</strong>：不依赖任何第三方网络共享存储，让 MySQL 与 MongoDB 自身的高可用机制来跨物理机同步数据。每台物理机挂载本地高性能 NVMe/SSD 盘。
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-amber-300 font-bold">Master 1 (192.168.1.101)</div>
                        <div className="text-slate-300">• MySQL Primary (主写)</div>
                        <div className="text-slate-300">• MongoDB Primary (主写)</div>
                        <div className="text-[10px] text-slate-500">存储路径: /opt/kubernetes/data/node1</div>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-blue-300 font-bold">Master 2 (192.168.1.102)</div>
                        <div className="text-slate-300">• MySQL Replica 1 (半同步从)</div>
                        <div className="text-slate-300">• MongoDB Secondary 1</div>
                        <div className="text-[10px] text-slate-500">存储路径: /opt/kubernetes/data/node2</div>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                        <div className="text-purple-300 font-bold">Master 3 (192.168.1.103)</div>
                        <div className="text-slate-300">• MySQL Replica 2 (候选备库)</div>
                        <div className="text-slate-300">• MongoDB Secondary 2</div>
                        <div className="text-[10px] text-slate-500">存储路径: /opt/kubernetes/data/node3</div>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg text-xs text-slate-300 space-y-1">
                      <strong className="text-emerald-400">为什么最适合 3 台物理机？</strong>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        当任意一台物理机断电宕机，MySQL MGR / 半同步从库与 MongoDB Raft 协议在 3~5 秒内自动选出新主库接管，数据绝不丢失，且无任何网络文件锁性能损耗。
                      </p>
                    </div>
                  </div>

                  {/* K8s Local PV YAML Snippet */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono text-slate-400 font-bold">K8s Local StorageClass & PVC 定义:</span>
                    <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-mysql-node1
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  local:
    path: /opt/kubernetes/data/mysql
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - k8s-master-01`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Solution B: Distributed Block Storage (Longhorn) */}
              {storageSolutionTab === 'distributed' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px]">
                          云原生分布式存储
                        </span>
                        方案 B：K8s 分布式共享块存储 (Rook-Ceph / Longhorn)
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400">副本数: 3 副本跨主机镜像</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>核心原理</strong>：在 3 台物理主机上部署轻量级开源分布式块存储（如 <strong>Longhorn</strong>）。Longhorn 自动聚合 3 台主机的空闲磁盘空间为一个统一的存储池，并在 3 台主机之间建立数据同步镜像（Replication = 3）。
                    </p>
                    <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
                      <div className="text-cyan-300 font-bold">优势与工作流程：</div>
                      <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                        <li><strong>彻底解耦计算与存储</strong>：MySQL 或 Mongo 只需要声明一个标准的 <code className="text-slate-200">ReadWriteOnce</code> PVC；</li>
                        <li><strong>跨机自由飘移</strong>：如果物理机 1 故障，K8s 会将 MySQL Pod 自动调度到物理机 2，Longhorn 底层网络块设备自动在物理机 2 挂载，数据完全保留；</li>
                        <li><strong>支持定时快照推送到 S3</strong>：Longhorn 内置原生支持直接将卷快照自动备份至 MinIO / S3 对象存储。</li>
                      </ul>
                    </div>
                  </div>

                  {/* Longhorn PVC Example */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono text-slate-400 font-bold">Longhorn PVC 资源声明:</span>
                    <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-longhorn-pvc
  namespace: data-platform
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: longhorn
  resources:
    requests:
      storage: 100Gi`}
                    </pre>
                  </div>
                </div>
              )}

              {/* Solution C: Local Fast Disk + S3 Streaming Backup (Selected Standard) */}
              {storageSolutionTab === 's3_hybrid' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                          当前默认已生效方案
                        </span>
                        方案 3：本地高性能磁盘 + MinIO S3 冷备份与日志归档灾备 (MySQL & MongoDB)
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300">MySQL & Mongo 均采用 S3 冷备份 • Mongo 3节点副本集群</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong>架构精髓</strong>：解决“数据放哪台物理机都不合适”与“S3不能直接跑数据库原生数据盘”的矛盾：<br/>
                      1. <strong>日常读写</strong>：利用每台物理机的本地 NVMe/SSD 高性能持久卷，保持 &lt;0.2ms 超低延迟与百万级 IOPS；<br/>
                      2. <strong>高可用机制</strong>：MongoDB 采用 <strong>3 节点原生副本集群 (rs0)</strong>，MySQL 采用 GTID 主从半同步，跨 3 台物理主机保证主机宕机 3~5 秒无感切换；<br/>
                      3. <strong>跨机安全兜底</strong>：通过 K8s 定时 CronJob 自动将 MySQL 与 MongoDB 的<strong>全量快照与增量 Oplog/Binlog 流式上传至中央 MinIO S3 桶</strong>，即使 3 台机器全部硬件损毁也可秒级异地拉取恢复。
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs pt-1">
                      <div className="bg-slate-900/90 p-3.5 rounded-xl border border-blue-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-400 font-bold flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" /> MySQL 8.4 S3 冷备体系
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            每日 03:00 UTC
                          </span>
                        </div>
                        <ul className="text-[11px] text-slate-300 font-sans space-y-1 list-disc list-inside">
                          <li><strong>备份策略</strong>：基于 <code className="text-cyan-300">mysqldump --single-transaction --quick</code> 压缩后流式推送到 MinIO；</li>
                          <li><strong>存储路径</strong>：<code className="text-blue-300">s3://mysql-backups/mysql_YYYYMMDD_HHMMSS.sql.gz</code>；</li>
                          <li><strong>保留周期 (3 份轮转)</strong>：<span className="text-amber-300 font-bold">严格仅保留最新 3 份冷备数据</span>，超额自动安全剪裁，杜绝打满存储；</li>
                          <li><strong>一键还原命令</strong>：
                            <pre className="bg-slate-950 p-1.5 mt-1 rounded text-[10px] text-cyan-300 font-mono overflow-x-auto">aws --endpoint-url={s3Endpoint} s3 cp s3://mysql-backups/latest.sql.gz - | gunzip | mysql -h mysql-0 -uroot -p</pre>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-slate-900/90 p-3.5 rounded-xl border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" /> MongoDB 8.0 副本集群 + S3 冷备
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            每日 02:00 UTC
                          </span>
                        </div>
                        <ul className="text-[11px] text-slate-300 font-sans space-y-1 list-disc list-inside">
                          <li><strong>集群模式</strong>：<strong>3 节点副本集群 (ReplicaSet rs0)</strong>，1 Primary + 2 Secondaries 跨物理机；</li>
                          <li><strong>备份策略</strong>：基于 <code className="text-cyan-300">mongodump --oplog --archive</code> 零停机热备；</li>
                          <li><strong>存储路径</strong>：<code className="text-emerald-300">s3://mongodb-backups/mongo_YYYYMMDD_HHMMSS.archive.gz</code>；</li>
                          <li><strong>保留周期 (3 份轮转)</strong>：<span className="text-amber-300 font-bold">严格仅保留最新 3 份冷备数据</span>，备份后自动清理旧版本；</li>
                          <li><strong>一键还原命令</strong>：
                            <pre className="bg-slate-950 p-1.5 mt-1 rounded text-[10px] text-cyan-300 font-mono overflow-x-auto">aws --endpoint-url={s3Endpoint} s3 cp s3://mongodb-backups/latest.archive.gz - | mongorestore --oplogReplay --archive</pre>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* K8s S3 Backup CronJob Snippet */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-xs font-mono text-slate-400 font-bold flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      当前运行中的 MySQL & MongoDB S3 冷备份 CronJob (严格保留最新 3 份数据):
                    </span>
                    <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`# 1. MongoDB 副本集群 (rs0) S3 冷备份 (保留最新 3 份)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongodb-backup-to-s3
  namespace: data-platform
spec:
  schedule: "0 2 * * *" # 每天 02:00 UTC 执行冷备份并推送至 S3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: mongo-backup
            image: mongo:8.0.9
            command:
            - /bin/bash
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              # 1. 抽取一致性快照并上传 S3
              mongodump --host="mongodb-0.mongodb-headless:27017" \\
                --username="admin" --password="$MONGO_PASSWORD" --authenticationDatabase="admin" \\
                --oplog --archive | aws --endpoint-url=${s3Endpoint} s3 cp - s3://mongodb-backups/mongo_\${TIMESTAMP}.archive.gz
              # 2. 轮转裁剪：严格只保留最新 3 份备份，自动清理旧文件
              OLD_BACKUPS=$(aws --endpoint-url=${s3Endpoint} s3 ls s3://mongodb-backups/ | grep "mongo_" | sort | head -n -3 | awk '{print $4}')
              for FILE in $OLD_BACKUPS; do
                aws --endpoint-url=${s3Endpoint} s3 rm "s3://mongodb-backups/$FILE"
              done
---
# 2. MySQL 8.4 S3 冷备份 (保留最新 3 份)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mysql-backup-to-s3
  namespace: data-platform
spec:
  schedule: "0 3 * * *" # 每天 03:00 UTC 执行冷备份并推送至 S3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: mysql-backup
            image: mysql:8.4.6
            command:
            - /bin/bash
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              # 1. 抽取一致性快照并上传 S3
              mysqldump -h mysql-0.mysql-headless -u root -p"$MYSQL_ROOT_PASSWORD" \\
                --all-databases --single-transaction --quick --routines --triggers \\
                | gzip | aws --endpoint-url=${s3Endpoint} s3 cp - s3://mysql-backups/mysql_\${TIMESTAMP}.sql.gz
              # 2. 轮转裁剪：严格只保留最新 3 份备份，自动清理旧文件
              OLD_BACKUPS=$(aws --endpoint-url=${s3Endpoint} s3 ls s3://mysql-backups/ | grep "mysql_" | sort | head -n -3 | awk '{print $4}')
              for FILE in $OLD_BACKUPS; do
                aws --endpoint-url=${s3Endpoint} s3 rm "s3://mysql-backups/$FILE"
              done`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. VALUES CONFIGURATOR */}
        {activeTab === 'values' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-white">Dynamic values.yaml Preview</span>
              <button
                onClick={() => copyToClipboard(dynamicValuesYaml, 'values-copy')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {copiedId === 'values-copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy values.yaml
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-auto max-h-[500px]">
              {dynamicValuesYaml}
            </pre>
          </div>
        )}

        {/* 7. RUNBOOK (INSTALL.md) */}
        {activeTab === 'runbook' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  工程内置手册: INSTALL.md
                </h2>
                <span className="text-xs text-slate-400 font-mono">位于根目录 /INSTALL.md</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-emerald-400"># 快速在每台 Master 节点执行 Keepalived + HAProxy 配置:</div>
                <div className="text-slate-300">sudo ./scripts/k8s-ha-setup/setup-haproxy-keepalived.sh {vipIp} auto 192.168.1.101 192.168.1.102 192.168.1.103</div>
                
                <div className="text-emerald-400 mt-2"># 部署业务组件全栈:</div>
                <div className="text-slate-300">helm upgrade --install cloudcluster ./helm -n data-platform --create-namespace -f ./helm/values.yaml</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================== */}
      {/* 1. UNIVERSAL CONFIRMATION MODAL (Mandatory for Add/Remove & Scaling)   */}
      {/* ====================================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.isDestructive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}>
                  {confirmModal.isDestructive ? <AlertCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Target: <span className="font-mono text-cyan-300">{confirmModal.targetName}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="text-slate-500 hover:text-white transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Details */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="text-slate-300">{confirmModal.details}</div>
              {confirmModal.warningText && (
                <div className="p-2.5 rounded bg-amber-950/60 border border-amber-600/40 text-amber-200 text-[11px] font-sans flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{confirmModal.warningText}</span>
                </div>
              )}
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className={`px-5 py-2 rounded-xl text-white text-xs font-semibold transition shadow-lg flex items-center gap-1.5 ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                }`}
              >
                <Check className="w-4 h-4" />
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 2. DEDICATED WORKER NODE MANUAL CLI WINDOW MODAL                      */}
      {/* ====================================================================== */}
      {workerCliModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    Manual Execution Script for {workerCliModal.hostname}
                  </h3>
                  <p className="text-xs text-slate-400">Target IP: {workerCliModal.ip}</p>
                </div>
              </div>
              <button
                onClick={() => setWorkerCliModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <p>请登录目标物理机或虚拟机（<strong>{workerCliModal.ip}</strong>），以 <code className="text-amber-300">root</code> 或 <code className="text-amber-300">sudo</code> 权限粘贴并执行以下命令：</p>
            </div>

            <div className="relative bg-black rounded-xl p-4 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
              <button
                onClick={() => copyToClipboard(workerCliModal.script, 'worker-script-copy')}
                className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 transition border border-slate-700"
              >
                {copiedId === 'worker-script-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'worker-script-copy' ? 'Copied!' : 'Copy Script'}
              </button>
              <pre className="pr-20 leading-relaxed">{workerCliModal.script}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                执行完毕后，在 Master 节点运行 <code className="text-cyan-300">kubectl get nodes</code> 查看新节点。
              </span>
              <button
                onClick={() => setWorkerCliModal(null)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Done (已在物理机执行)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kafka Connect S3 Direct Sink Modal */}
      {showKafkaS3Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Direct Kafka-To-MinIO-S3-Streaming-Sink Connector
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configuration stored in <code className="text-cyan-300">/scripts/kafka-connect/kafka-s3-sink-connector.json</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKafkaS3Modal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              此配置通过 <strong>Kafka Connect 原生 S3 Sink 连接器</strong>直接拉取 Kafka 主题数据并批量流式写入 MinIO S3，<strong>无需启动或经过 Flink 引擎</strong>，零额外计算开销，支持时间戳目录划分和 Exactly-Once 语义。
            </p>

            <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-72">
              <button
                onClick={() => copyToClipboard(`curl -X POST -H "Content-Type: application/json" --data @./scripts/kafka-connect/kafka-s3-sink-connector.json http://localhost:8083/connectors`, 'copy-s3-curl')}
                className="absolute top-3 right-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-sans font-medium flex items-center gap-1.5 transition border border-slate-700"
              >
                {copiedId === 'copy-s3-curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'copy-s3-curl' ? 'Copied CLI!' : 'Copy Deploy CLI'}
              </button>
              <pre className="text-slate-300">{`{
  "name": "Kafka-To-MinIO-S3-Streaming-Sink",
  "config": {
    "connector.class": "io.confluent.connect.s3.S3SinkConnector",
    "tasks.max": "3",
    "topics": "iot-telemetry-events,user-activity-stream,order-transactions",
    "s3.region": "us-east-1",
    "s3.bucket.name": "flink-checkpoints",
    "store.url": "http://minio:9000",
    "storage.class": "io.confluent.connect.s3.storage.S3Storage",
    "format.class": "io.confluent.connect.s3.format.json.JsonFormat",
    "partitioner.class": "io.confluent.connect.storage.partitioner.TimeBasedPartitioner",
    "path.format": "'year'=YYYY/'month'=MM/'day'=dd/'hour'=HH",
    "flush.size": "1000",
    "rotate.interval.ms": "60000"
  }
}`}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowKafkaS3Modal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Realtime-Event-Metrics-Aggregator Graph & LAG Modal */}
      {showMetricsGraphModal && (() => {
        const activeTopic = topicMetrics.find(t => t.topic === selectedTopicName) || topicMetrics[0];
        const maxRate = Math.max(...activeTopic.history.map(h => h.msgRate)) * 1.2;
        const maxLag = Math.max(350, Math.max(...activeTopic.history.map(h => h.lag)) * 1.25);
        
        // Calculate SVG paths for message rate
        const ratePoints = activeTopic.history.map((h, i) => {
          const x = 50 + (i / (activeTopic.history.length - 1)) * 430;
          const y = 20 + (1 - h.msgRate / maxRate) * 95;
          return { x, y, ...h };
        });
        const rateLinePath = ratePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const rateAreaPath = `${rateLinePath} L ${ratePoints[ratePoints.length - 1].x.toFixed(1)},115 L ${ratePoints[0].x.toFixed(1)},115 Z`;

        // Calculate SVG paths for consumer lag
        const lagPoints = activeTopic.history.map((h, i) => {
          const x = 50 + (i / (activeTopic.history.length - 1)) * 430;
          const y = 20 + (1 - h.lag / maxLag) * 95;
          return { x, y, ...h };
        });
        const lagLinePath = lagPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const lagAreaPath = `${lagLinePath} L ${lagPoints[lagPoints.length - 1].x.toFixed(1)},115 L ${lagPoints[0].x.toFixed(1)},115 Z`;
        const warnThresholdY = 20 + (1 - 300 / maxLag) * 95;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Kafka Topic 吞吐量与 Consumer LAG 实时图形监控
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Live Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      由 Flink 作业 <code className="text-amber-300">Realtime-Event-Metrics-Aggregator</code> 实时采集并汇总
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMetricsGraphModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Topic Selector Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
                <span className="text-xs text-slate-400 mr-1">选择监控 Topic:</span>
                {topicMetrics.map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => setSelectedTopicName(t.topic)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-2 border ${
                      selectedTopicName === t.topic
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{t.topic}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-sans ${
                      t.status === 'WARNING'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-emerald-400'
                    }`}>
                      LAG: {t.currentLag}
                    </span>
                  </button>
                ))}
              </div>

              {/* Selected Topic KPI Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">消息总量 (Total Ingested)</div>
                  <div className="text-base font-bold text-white mt-0.5">{activeTopic.totalMessages.toLocaleString()} msgs</div>
                  <div className="text-[10px] text-slate-500">累计写入条数</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">当前生产吞吐 (Rate)</div>
                  <div className="text-base font-bold text-cyan-400 mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {activeTopic.ratePerSec.toLocaleString()} msgs/s
                  </div>
                  <div className="text-[10px] text-slate-500">毫秒级滑动窗口</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">消费组 (Consumer Group)</div>
                  <div className="text-xs font-bold text-purple-300 mt-1 truncate" title={activeTopic.consumerGroup}>
                    {activeTopic.consumerGroup}
                  </div>
                  <div className="text-[10px] text-slate-500">Partition Rebalance: OK</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">当前积压延迟 (Consumer LAG)</div>
                  <div className={`text-base font-bold mt-0.5 ${
                    activeTopic.currentLag > 300 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {activeTopic.currentLag} 条未消费
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {activeTopic.currentLag > 300 ? '⚠️ 存在消费延迟' : '✅ 消费处于健康位点'}
                  </div>
                </div>
              </div>

              {/* Graphical Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chart 1: Message Throughput Rate */}
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      Topic 消息流入速率走势 (Throughput Rate: msgs/sec)
                    </span>
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                      Now: {activeTopic.ratePerSec} msgs/s
                    </span>
                  </div>
                  <div className="w-full bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                    <svg viewBox="0 0 500 135" className="w-full h-36 overflow-visible font-mono text-[10px]">
                      <defs>
                        <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      <line x1="50" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="50" y1="67" x2="480" y2="67" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="50" y1="115" x2="480" y2="115" stroke="#334155" opacity="0.8" />

                      {/* Y-axis values */}
                      <text x="42" y="24" textAnchor="end" fill="#64748b">{Math.round(maxRate)}</text>
                      <text x="42" y="71" textAnchor="end" fill="#64748b">{Math.round(maxRate / 2)}</text>
                      <text x="42" y="118" textAnchor="end" fill="#64748b">0</text>

                      {/* Area & Line */}
                      <path d={rateAreaPath} fill="url(#rateGradient)" />
                      <path d={rateLinePath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

                      {/* Data Points */}
                      {ratePoints.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="3.5" fill="#0891b2" stroke="#ffffff" strokeWidth="1.5" />
                          <text x={p.x} y={p.y - 7} textAnchor="middle" fill="#a5f3fc" fontSize="9">{p.msgRate}</text>
                          <text x={p.x} y="130" textAnchor="middle" fill="#64748b">{p.time}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>

                {/* Chart 2: Consumer LAG */}
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-amber-400" />
                      Consumer Group 延迟走势 (Consumer LAG: messages)
                    </span>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      activeTopic.currentLag > 300 
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800' 
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                    }`}>
                      LAG: {activeTopic.currentLag} msgs
                    </span>
                  </div>
                  <div className="w-full bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                    <svg viewBox="0 0 500 135" className="w-full h-36 overflow-visible font-mono text-[10px]">
                      <defs>
                        <linearGradient id="lagGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      <line x1="50" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="50" y1="67" x2="480" y2="67" stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
                      <line x1="50" y1="115" x2="480" y2="115" stroke="#334155" opacity="0.8" />

                      {/* Warning threshold line (300 msgs) */}
                      {warnThresholdY >= 20 && warnThresholdY <= 115 && (
                        <g>
                          <line x1="50" y1={warnThresholdY} x2="480" y2={warnThresholdY} stroke="#f43f5e" strokeDasharray="4 2" strokeWidth="1" opacity="0.7" />
                          <text x="475" y={warnThresholdY - 3} textAnchor="end" fill="#fb7185" fontSize="8">Threshold 300</text>
                        </g>
                      )}

                      {/* Y-axis values */}
                      <text x="42" y="24" textAnchor="end" fill="#64748b">{Math.round(maxLag)}</text>
                      <text x="42" y="71" textAnchor="end" fill="#64748b">{Math.round(maxLag / 2)}</text>
                      <text x="42" y="118" textAnchor="end" fill="#64748b">0</text>

                      {/* Area & Line */}
                      <path d={lagAreaPath} fill="url(#lagGradient)" />
                      <path d={lagLinePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

                      {/* Data Points */}
                      {lagPoints.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="3.5" fill="#d97706" stroke="#ffffff" strokeWidth="1.5" />
                          <text x={p.x} y={p.y - 7} textAnchor="middle" fill="#fde68a" fontSize="9">{p.lag}</text>
                          <text x={p.x} y="130" textAnchor="middle" fill="#64748b">{p.time}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Partition Level Breakdown for Selected Topic */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-purple-400" />
                    Topic 分区 (Partitions) 消费位点与 LAG 细分
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Leader Broker: 3 KRaft Controller Quorum
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeTopic.partitions.map((pt) => {
                    const lagPercent = Math.min(100, Math.round((pt.lag / (pt.endOffset - pt.currentOffset + pt.lag || 1)) * 100));
                    return (
                      <div key={pt.id} className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-300">Partition {pt.id}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            pt.lag > 100 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            LAG: {pt.lag}
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px] text-slate-400">
                          <div className="flex justify-between">
                            <span>Current Offset:</span>
                            <span className="text-slate-200">{pt.currentOffset.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Log-End Offset:</span>
                            <span className="text-slate-200">{pt.endOffset.toLocaleString()}</span>
                          </div>
                        </div>
                        {/* Visual Progress bar */}
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                          <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full" style={{ width: '99%' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <span className="text-xs text-slate-400 font-mono">
                  # 监控指令: <code className="text-slate-300">kafka-consumer-groups.sh --bootstrap-server kafka:9092 --describe --group {activeTopic.consumerGroup}</code>
                </span>
                <button
                  onClick={() => setShowMetricsGraphModal(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  关闭图形窗口 (Close)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VIP / Domain Update Detailed Result Modal */}
      {vipUpdateResult?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    高可用集群接入终端已成功变更并生效
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Executed
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    后端已修改全部关联配置文件，对应应用与服务已自动完成重启。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVipUpdateResult(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Old vs New Endpoint Comparison */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 block">原接入终端 (OLD ENDPOINT)</span>
                <span className="text-slate-400 line-through">{vipUpdateResult.oldEndpoint}:{vipUpdateResult.port}</span>
              </div>
              <div className="text-cyan-400 font-bold text-sm hidden sm:block">➔</div>
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-400 font-semibold block">新接入终端 (ACTIVE NEW ENDPOINT)</span>
                <span className="text-emerald-300 font-bold text-sm">{vipUpdateResult.newEndpoint}:{vipUpdateResult.port}</span>
              </div>
              <div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-sans font-medium border ${
                  vipUpdateResult.isDomain
                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}>
                  {vipUpdateResult.isDomain ? '🌐 域名 FQDN 接入模式' : '⚡ 虚拟 IP (VIP) 模式'}
                </span>
              </div>
            </div>

            {/* Updated Files Grid (All Configs Updated) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <FileText className="w-4 h-4 text-cyan-400" />
                后端已修改的全部配置文件清单 (Updated Configuration Files):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {vipUpdateResult.updatedFiles.map((file, idx) => (
                  <div key={idx} className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate" title={file}>{file}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Restarted Services */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                已自动重启的应用与服务 (Automatically Restarted Services):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {vipUpdateResult.restartedServices.map((svc, idx) => (
                  <div key={idx} className="bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/30 flex items-center gap-2 text-amber-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate" title={svc}>{svc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Logs */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-500 font-semibold mb-1"># 终端变更与重签发执行日志流:</div>
              {vipUpdateResult.logs.map((log, idx) => (
                <div key={idx} className="text-emerald-400/90">{log}</div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setVipUpdateResult(null)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30"
              >
                完成并确认 (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>CloudCluster Stack • Equipped with K8s HA Control Plane, Keepalived VIP & Universal Confirmation Safeguards.</p>
      </footer>
    </div>
  );
}
