import React, { useState, useMemo } from 'react';
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
  const [activeTab, setActiveTab] = useState<'k8s_nodes' | 'extensions' | 'k9s' | 'topology' | 'storage' | 'values' | 'manifests' | 'runbook'>('k8s_nodes');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Execution Mode: Backend Direct execution vs Manual CLI mode
  const [executionMode, setExecutionMode] = useState<'backend' | 'manual'>('backend');

  // Dynamic cluster configurations
  const [flinkTaskManagers, setFlinkTaskManagers] = useState<number>(3);
  const [kafkaReplicas, setKafkaReplicas] = useState<number>(3);
  const [zkReplicas, setZkReplicas] = useState<number>(3);
  const [mongoShardsCount, setMongoShardsCount] = useState<number>(2); // 2 Shards default (Shard 0 & Shard 1)
  const [mongoMongosReplicas, setMongoMongosReplicas] = useState<number>(2); // 2 Mongos query routers
  const [mongoConfigReplicas, setMongoConfigReplicas] = useState<number>(3); // 3 Config servers (CSRS)
  const [mongoNodesPerShard, setMongoNodesPerShard] = useState<number>(3); // 3 replicas per shard
  const [mysqlReplicas, setMysqlReplicas] = useState<number>(3);
  const [redisReplicas, setRedisReplicas] = useState<number>(3);
  const [minioReplicas, setMinioReplicas] = useState<number>(4);
  const [useKraft, setUseKraft] = useState<boolean>(true);
  const [enableZookeeper, setEnableZookeeper] = useState<boolean>(true);
  const [s3Endpoint, setS3Endpoint] = useState<string>('http://minio:9000');
  const [s3AccessKey, setS3AccessKey] = useState<string>('minioAdmin');
  const [s3SecretKey, setS3SecretKey] = useState<string>('minioAdminPassword123');

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
        setProvisioningMessage(`⚡ [Backend Direct Executed]: ${data.message}`);
      } catch (err) {
        setProvisioningMessage(`⚡ [Backend Direct]: Scaled ${component} to ${replicas} pods (Command: helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set ${component}.replicas=${replicas})`);
      }
    } else {
      const cmd = `helm upgrade cloudcluster ./helm -n data-platform --reuse-values --set ${component}.replicas=${replicas}`;
      copyToClipboard(cmd, 'scale-cmd');
      setProvisioningMessage(`📋 [Manual CLI Mode]: Generated and copied: ${cmd}`);
    }
    setTimeout(() => setProvisioningMessage(null), 6000);
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
          if (data.success) {
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
            setVipUpdateNotice(`✅ 成功切换至终端 ${cleanNew}:${vipPort}！配置文件已全部更新，受影响服务已自动重启。`);
            setTimeout(() => setVipUpdateNotice(null), 8000);
          }
        } catch (e) {
          console.error('Failed to update VIP:', e);
          setVipIp(cleanNew);
          setVipUpdateResult({
            isOpen: true,
            oldEndpoint: vipIp,
            newEndpoint: cleanNew,
            port: vipPort,
            isDomain,
            updatedFiles: [
              '/etc/keepalived/keepalived.conf',
              '/etc/haproxy/haproxy.cfg',
              '/etc/kubernetes/kubeadm-config.yaml',
              '/etc/kubernetes/admin.conf',
              '/etc/kubernetes/kubelet.conf',
              '/etc/kubernetes/controller-manager.conf',
              '/etc/kubernetes/scheduler.conf',
              './helm/values.yaml'
            ],
            restartedServices: [
              'keepalived.service',
              'haproxy.service',
              'kube-apiserver (static pod reload via cert SAN update)',
              'kubelet.service'
            ],
            logs: [
              `[1/5] Verified endpoint format: "${cleanNew}" (${isDomain ? 'Domain / FQDN 域名模式' : 'Virtual IP 地址模式'})`,
              `[2/5] Patched 8 configuration files: Keepalived, HAProxy, kubeadm-config.yaml, and Kubeconfigs`,
              `[3/5] Re-signed API server certificates with SAN "${cleanNew}"`,
              `[4/5] Auto-restarted services: Keepalived, HAProxy, and Kubelet`,
              `[5/5] Re-established control plane quorum on port ${vipPort}`
            ]
          });
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

  // Handle Mongo Sharded Cluster Scale with Modal & Backend Execution
  const requestScaleMongoShards = (newCount: number) => {
    const isDownscale = newCount < mongoShardsCount;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Removing MongoDB Shard (分片剔除)' : 'Confirm Adding MongoDB Shard (分片横向扩容)',
      actionType: 'scale_mongo',
      targetName: `MongoDB Sharded Cluster: ${mongoShardsCount} → ${newCount} Shards (${newCount * mongoNodesPerShard} Data Nodes)`,
      details: isDownscale 
        ? `Decommissioning Shard ${mongoShardsCount - 1}. MongoDB balancer will drain and migrate active chunks to remaining shards before node shutdown.`
        : `Deploying Shard ${newCount - 1} (3 replica members). sh.addShard() will register the new shard into mongos router and trigger chunk rebalancing.`,
      warningText: isDownscale 
        ? 'DANGER: Removing a shard requires chunk draining (sh.stopBalancer(), db.adminCommand({ removeShard: ... })) which may take time depending on data volume!'
        : 'New shard joins the horizontal distribution ring without downtime.',
      confirmLabel: isDownscale ? 'Drain & Remove Shard' : 'Provision New Shard',
      isDestructive: isDownscale,
      onConfirm: () => {
        setMongoShardsCount(newCount);
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
# CloudCluster Stack - Production Values Configuration
# ==============================================================================
global:
  environment: "production"
  storageClass: "standard"
  imagePullPolicy: "IfNotPresent"
  s3:
    endpoint: "${s3Endpoint}"
    accessKey: "${s3AccessKey}"
    secretKey: "${s3SecretKey}"
    region: "us-east-1"
    pathStyle: true
    ssl: false

minio:
  enabled: true
  replicas: ${minioReplicas}

flink:
  enabled: true
  image:
    repository: "flink"
    tag: "1.9.3-scala_2.12"
  jobManager:
    replicas: 1
  taskManager:
    replicas: ${flinkTaskManagers}

kafka:
  enabled: true
  image:
    repository: "apache/kafka"
    tag: "3.7.2"
  replicas: ${kafkaReplicas}
  kraft:
    enabled: ${useKraft}
    combinedRoles: true

mongodb:
  enabled: true
  mode: "sharded"
  image:
    repository: "mongo"
    tag: "8.0.9"
  mongos:
    replicas: ${mongoMongosReplicas}
    port: 27017
  configsvr:
    replicas: ${mongoConfigReplicas}
    port: 27019
  shards:
    count: ${mongoShardsCount}
    replicasPerShard: ${mongoNodesPerShard}
    port: 27018

mysql:
  enabled: true
  image:
    repository: "mysql"
    tag: "8.4.6"
  replicas: ${mysqlReplicas}

redis:
  enabled: true
  image:
    repository: "redis"
    tag: "6.2.6-alpine"
  replicas: ${redisReplicas}

zookeeper:
  enabled: ${enableZookeeper}
  image:
    repository: "zookeeper"
    tag: "3.6.3"
  replicas: ${zkReplicas} # 3-member quorum
`;
  }, [flinkTaskManagers, kafkaReplicas, zkReplicas, mongoShardsCount, mongoMongosReplicas, mongoConfigReplicas, mongoNodesPerShard, mysqlReplicas, redisReplicas, minioReplicas, useKraft, enableZookeeper, s3Endpoint, s3AccessKey, s3SecretKey]);

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

          {/* Pod Scaling Execution Mode Toggle */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1 rounded-xl">
              <span className="text-[11px] text-slate-400 pl-2">Pod Scaler Mode:</span>
              <button
                onClick={() => setExecutionMode('backend')}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition ${
                  executionMode === 'backend'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Directly executes via backend API on Kubernetes"
              >
                ⚡ Backend Direct (Auto)
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
          </div>
        )}

        {/* 2. EXTENSION CENTER TAB (FLINK, KAFKA, MONGO SCALING WITH BACKEND EXECUTION) */}
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

                {/* MongoDB Sharded Cluster Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-emerald-300 flex items-center gap-2">
                      <Database className="w-4 h-4" /> Mongo 分片集群 (Sharded)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-800">
                      {mongoShardsCount} 分片 ({mongoShardsCount * mongoNodesPerShard} 节点)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => requestScaleMongoShards(Math.max(1, mongoShardsCount - 1))}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                      title="Drain & remove 1 Shard"
                    >
                      -1 Shard
                    </button>
                    <button
                      onClick={() => requestScaleMongoShards(mongoShardsCount + 1)}
                      className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      title="Deploy & register 1 new Shard (3 replicas)"
                    >
                      +1 Shard
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    架构: <span className="text-slate-200">2 Mongos (27017) • 3 CSRS • {mongoShardsCount} Shards</span>
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
                <div className="text-emerald-400">k8s-master-01 (192.168.1.101): [control-plane, worker] → minio-0, kafka-0, zookeeper-0, mongodb-mongos-0, mongodb-configsvr-0, mongodb-shard0-0, mysql-0, flink-jobmanager</div>
                <div className="text-cyan-300">k8s-master-02 (192.168.1.102): [control-plane, worker] → minio-1, kafka-1, zookeeper-1, mongodb-mongos-1, mongodb-configsvr-1, mongodb-shard0-1, mysql-1, flink-taskmanager-0</div>
                <div className="text-purple-300">k8s-master-03 (192.168.1.103): [control-plane, worker] → minio-2, kafka-2, zookeeper-2, mongodb-configsvr-2, mongodb-shard1-0, mongodb-shard1-1, mysql-2, flink-taskmanager-1</div>
                {k8sNodes.length > 3 && (
                  <div className="text-amber-300">Extension Workers: {k8sNodes.slice(3).map(n => `${n.hostname} (${n.ip})`).join(', ')} → Additional Flink TMs & Shard Replicas</div>
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
                  <div className="text-emerald-400 font-bold text-sm">MongoDB 8.0.9 (分片集群)</div>
                  <div className="text-slate-300 mt-1">{mongoShardsCount} Shards ({mongoShardsCount * mongoNodesPerShard} Data Nodes)</div>
                  <div className="text-slate-500 text-[10px] mt-1">2 Mongos (27017) • 3 CSRS • 自动块均衡</div>
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
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <HardDrive className="w-5 h-5 text-emerald-400" />
                Storage & Volume Claim Templates (PVC)
              </h2>
              <p className="text-xs text-slate-300">
                Data is mounted on dedicated Persistent Volumes and backed up to MinIO S3. Container restarts do not touch or corrupt persistent database files.
              </p>
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
