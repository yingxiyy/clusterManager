import React, { useState, useMemo } from 'react';
import { 
  Server, Database, Cloud, HardDrive, Cpu, Terminal, Copy, Check, 
  Layers, Shield, RefreshCw, Play, Settings, Download, ExternalLink,
  ChevronRight, Box, Activity, Sliders, FileText, CheckCircle2, AlertTriangle,
  Search, Plus, Minus, Eye, Trash2, ArrowUpRight, Zap, Radio, Globe, Key, User, Folder, Lock, AlertCircle, X
} from 'lucide-react';

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

interface ConfirmModalData {
  isOpen: boolean;
  title: string;
  actionType: 'add_k8s_node' | 'remove_k8s_node' | 'scale_kafka' | 'scale_mongo' | 'scale_flink' | 'scale_mysql' | 'scale_redis';
  targetName: string;
  details: string;
  warningText?: string;
  confirmLabel: string;
  isDestructive: boolean;
  onConfirm: () => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'k8s_nodes' | 'extensions' | 'k9s' | 'topology' | 'storage' | 'values' | 'manifests' | 'dockerfiles' | 'runbook'>('k8s_nodes');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Dynamic cluster configurations
  const [flinkTaskManagers, setFlinkTaskManagers] = useState<number>(3);
  const [kafkaReplicas, setKafkaReplicas] = useState<number>(3);
  const [mongoReplicas, setMongoReplicas] = useState<number>(3);
  const [mysqlReplicas, setMysqlReplicas] = useState<number>(3);
  const [redisReplicas, setRedisReplicas] = useState<number>(3);
  const [minioReplicas, setMinioReplicas] = useState<number>(4);
  const [useKraft, setUseKraft] = useState<boolean>(true);
  const [enableZookeeper, setEnableZookeeper] = useState<boolean>(false);
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

  // K8s Cluster HA Control Plane State (Keepalived VIP + HAProxy)
  const [vipIp, setVipIp] = useState<string>('192.168.1.100');
  const [vipPort, setVipPort] = useState<number>(6443);
  const [netInterface, setNetInterface] = useState<string>('eth0');

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
  const [newWorkerAuthType, setNewWorkerAuthType] = useState<'password' | 'key'>('password');
  const [newWorkerPassword, setNewWorkerPassword] = useState<string>('P@ssword123');
  const [newWorkerInstallDir, setNewWorkerInstallDir] = useState<string>('/opt/kubernetes');
  const [provisioningMessage, setProvisioningMessage] = useState<string | null>(null);

  // K9s Simulator State
  const [k9sFilter, setK9sFilter] = useState<string>('');
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<string | null>('flink-taskmanager-0');
  const [k9sActiveView, setK9sActiveView] = useState<'pods' | 'logs'>('pods');

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

  // Handle Add Extension Worker Node with Modal
  const requestAddWorkerNode = () => {
    triggerConfirmation({
      title: 'Confirm Adding Kubernetes Worker Node',
      actionType: 'add_k8s_node',
      targetName: `${newWorkerHostname} (${newWorkerIp})`,
      details: `Target machine: ${newWorkerIp}:${newWorkerSshPort} | User: ${newWorkerSshUser} | Install Dir: ${newWorkerInstallDir}. The node will be bootstrapped via SSH and joined to the HA Control Plane VIP (${vipIp}:${vipPort}).`,
      warningText: 'Ensure the target host is reachable via SSH and container runtime (containerd) is installed.',
      confirmLabel: 'Provision & Join Worker',
      isDestructive: false,
      onConfirm: () => {
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
        setProvisioningMessage(`✅ Successfully joined ${newWorkerHostname} (${newWorkerIp}) to the Kubernetes cluster!`);
        setTimeout(() => setProvisioningMessage(null), 5000);
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

  // Handle Kafka Scale with Modal
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
        setProvisioningMessage(`⚡ Kafka cluster scaled to ${newCount} KRaft nodes.`);
        setTimeout(() => setProvisioningMessage(null), 4000);
      }
    });
  };

  // Handle Mongo Scale with Modal
  const requestScaleMongo = (newCount: number) => {
    const isDownscale = newCount < mongoReplicas;
    triggerConfirmation({
      title: isDownscale ? 'Confirm Removing MongoDB Replica Member' : 'Confirm Adding MongoDB Replica Member',
      actionType: 'scale_mongo',
      targetName: `MongoDB Replica Set (rs0): ${mongoReplicas} → ${newCount} Members`,
      details: `MongoDB replica set topology will execute rs.reconfig() with ${newCount} voting members.`,
      warningText: isDownscale 
        ? 'Warning: The member will be permanently removed from replica set rs0. Data volumes remain on PVC.' 
        : 'New secondary member will perform initial sync from the primary node.',
      confirmLabel: isDownscale ? 'Remove Member' : 'Add Member',
      isDestructive: isDownscale,
      onConfirm: () => {
        setMongoReplicas(newCount);
        setProvisioningMessage(`⚡ MongoDB replica set updated to ${newCount} members.`);
        setTimeout(() => setProvisioningMessage(null), 4000);
      }
    });
  };

  // Handle Flink Scale with Modal
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
        setProvisioningMessage(`⚡ Flink TaskManagers scaled to ${newCount} pods (${newCount * 4} slots).`);
        setTimeout(() => setProvisioningMessage(null), 4000);
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
    replicas: ${flinkTaskManagers} # Extension worker member

kafka:
  enabled: true
  image:
    repository: "apache/kafka"
    tag: "3.7.2"
  replicas: ${kafkaReplicas} # 3-member Raft quorum
  kraft:
    enabled: ${useKraft}
    combinedRoles: true

mongodb:
  enabled: true
  image:
    repository: "mongo"
    tag: "8.0.9"
  replicas: ${mongoReplicas}

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
`;
  }, [flinkTaskManagers, kafkaReplicas, mongoReplicas, mysqlReplicas, redisReplicas, minioReplicas, useKraft, s3Endpoint, s3AccessKey, s3SecretKey]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-4">
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
                3-Master HA K8s • Shared Worker Workloads • Extensible Worker Pool • Flink 1.9.3 • Kafka KRaft
              </p>
            </div>
          </div>

          {/* Quick Node & Cluster Status */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-200">K8s Nodes: {k8sNodes.length} ({k8sNodes.filter(n => n.roles.includes('control-plane')).length} Masters, {k8sNodes.length} Workers)</span>
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
            { id: 'runbook', label: 'Deployment Runbook', icon: ArrowUpRight }
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

                {/* VIP Configuration Fields */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">VIRTUAL IP (VIP)</span>
                    <input
                      type="text"
                      value={vipIp}
                      onChange={(e) => setVipIp(e.target.value)}
                      className="bg-transparent text-emerald-400 font-bold focus:outline-none w-28"
                    />
                  </div>
                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-slate-400 block text-[10px]">PORT</span>
                    <input
                      type="number"
                      value={vipPort}
                      onChange={(e) => setVipPort(parseInt(e.target.value))}
                      className="bg-transparent text-slate-200 focus:outline-none w-14"
                    />
                  </div>
                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-slate-400 block text-[10px]">INTERFACE</span>
                    <input
                      type="text"
                      value={netInterface}
                      onChange={(e) => setNetInterface(e.target.value)}
                      className="bg-transparent text-cyan-300 focus:outline-none w-16"
                    />
                  </div>
                </div>
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
                  <h3 className="font-bold text-white text-base">Extend Cluster: Add New Worker Node</h3>
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

                {/* SSH Authentication Password / Key */}
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">SSH Password / Private Key</label>
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2.5">
                    <Key className="w-4 h-4 text-slate-500 mr-2" />
                    <input
                      type="password"
                      value={newWorkerPassword}
                      onChange={(e) => setNewWorkerPassword(e.target.value)}
                      className="w-full bg-transparent p-2 text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={requestAddWorkerNode}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Extension Worker (Requires Confirmation)
                </button>
              </div>
            </div>

            {/* Generated Ansible & Shell Script Snippet */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Kubeadm HA Cluster Scripts Generated for Master & Worker Machines
                </h3>
                <span className="text-xs text-slate-400">Available in <code className="text-cyan-300">/scripts/k8s-ha-setup/</code></span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-emerald-400"># Step 1: Install HAProxy & Keepalived VIP on all 3 Master Nodes:</div>
                <div className="text-slate-400">./scripts/k8s-ha-setup/setup-haproxy-keepalived.sh {vipIp} {netInterface} 192.168.1.101 192.168.1.102 192.168.1.103</div>
                
                <div className="text-emerald-400 mt-2"># Step 2: Initialize 3-Master Control-Plane and untaint nodes for worker pods:</div>
                <div className="text-slate-400">./scripts/k8s-ha-setup/init-masters.sh {vipIp}</div>

                <div className="text-emerald-400 mt-2"># Step 3: Join extension worker machines:</div>
                <div className="text-slate-400">./scripts/k8s-ha-setup/join-worker.sh {vipIp}:{vipPort} &lt;TOKEN&gt; &lt;HASH&gt; {newWorkerInstallDir}</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. EXTENSION CENTER TAB (FLINK, KAFKA, MONGO SCALING WITH CONFIRMATION) */}
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
                        Web API :8081 Active
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
                  <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">8 / {Math.max(0, flinkTaskManagers * 4 - 8)}</div>
                  <div className="text-[10px] text-slate-500">2 active streaming jobs</div>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                  <div className="flex items-center gap-3">
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

                {/* MongoDB Replica Set Scaler */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-emerald-300 flex items-center gap-2">
                      <Database className="w-4 h-4" /> MongoDB ReplicaSet
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-800">
                      {mongoReplicas} Members
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => requestScaleMongo(Math.max(3, mongoReplicas - 2))}
                      className="flex-1 py-1.5 rounded bg-slate-900 hover:bg-rose-900/60 text-slate-200 text-xs border border-slate-800"
                    >
                      -2 Members
                    </button>
                    <button
                      onClick={() => requestScaleMongo(mongoReplicas + 2)}
                      className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      +2 Members
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Replica Set: <span className="text-slate-200">rs0 with keyfile auth</span>
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        triggerConfirmation({
                          title: 'Confirm Removing MySQL Replica',
                          actionType: 'scale_mysql',
                          targetName: `MySQL: ${mysqlReplicas} → ${mysqlReplicas - 1} Pods`,
                          details: 'One read replica will be detached and deleted. Primary mysql-0 is unaffected.',
                          confirmLabel: 'Remove Replica',
                          isDestructive: true,
                          onConfirm: () => setMysqlReplicas(Math.max(2, mysqlReplicas - 1))
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
                          onConfirm: () => setMysqlReplicas(mysqlReplicas + 1)
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
                <div className="text-emerald-400">k8s-master-01 (192.168.1.101): [control-plane, worker] → minio-0, kafka-0, mongodb-0, flink-jobmanager</div>
                <div className="text-cyan-300">k8s-master-02 (192.168.1.102): [control-plane, worker] → minio-1, kafka-1, mongodb-1, flink-taskmanager-0</div>
                <div className="text-purple-300">k8s-master-03 (192.168.1.103): [control-plane, worker] → minio-2, kafka-2, mongodb-2, flink-taskmanager-1</div>
                {k8sNodes.length > 3 && (
                  <div className="text-amber-300">Extension Workers: {k8sNodes.slice(3).map(n => `${n.hostname} (${n.ip})`).join(', ')} → Additional Flink TMs & Replicas</div>
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
                Cluster Topology Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-cyan-400 font-bold">MinIO Distributed S3</div>
                  <div className="text-slate-400 mt-1">{minioReplicas} Pods • Erasure Coding</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-amber-400 font-bold">Flink 1.9.3 (Java 8)</div>
                  <div className="text-slate-400 mt-1">1 JobManager + {flinkTaskManagers} TaskManagers</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="text-purple-400 font-bold">Kafka KRaft</div>
                  <div className="text-slate-400 mt-1">{kafkaReplicas} Members (Combined Roles)</div>
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

        {/* 7. RUNBOOK */}
        {activeTab === 'runbook' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                Production Deployment Runbook
              </h2>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                <div className="text-emerald-400">1. Setup Keepalived VIP & HAProxy on 3 Masters:</div>
                <div className="text-slate-400">./scripts/k8s-ha-setup/setup-haproxy-keepalived.sh {vipIp} {netInterface} 192.168.1.101 192.168.1.102 192.168.1.103</div>
                <div className="text-emerald-400 mt-2">2. Deploy Helm Stack:</div>
                <div className="text-slate-400">helm upgrade --install cloudcluster ./helm -n data-platform --create-namespace -f ./helm/values.yaml</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ====================================================================== */}
      {/* UNIVERSAL CONFIRMATION MODAL (Mandatory for Add/Remove & Scaling)     */}
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

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>CloudCluster Stack • Equipped with K8s HA Control Plane, Keepalived VIP & Universal Confirmation Safeguards.</p>
      </footer>
    </div>
  );
}
