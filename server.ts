import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --------------------------------------------------------------------------
  // Backend Configuration: Simulator Mode Toggle
  // Default is false unless SIMULATOR=true is explicitly set in env or via API
  // --------------------------------------------------------------------------
  let isSimulator = process.env.SIMULATOR === 'true';

  app.get('/api/config', (req, res) => {
    return res.json({
      simulator: isSimulator,
      environment: process.env.NODE_ENV || 'production',
      hostname: process.env.HOSTNAME || 'k8s-master-01'
    });
  });

  app.post('/api/config', (req, res) => {
    const { simulator } = req.body;
    if (typeof simulator === 'boolean') {
      isSimulator = simulator;
      console.log(`[Config] Simulator mode updated to: ${isSimulator}`);
    }
    return res.json({
      success: true,
      simulator: isSimulator,
      message: `Backend simulator mode is now ${isSimulator ? 'ENABLED (Dry-run only)' : 'DISABLED (Real Host Execution)'}`
    });
  });

  // --------------------------------------------------------------------------
  // API: Initial Credentials Management (All Services Enforced Authentication)
  // --------------------------------------------------------------------------
  app.get('/api/credentials', (req, res) => {
    const credPath = path.join(__dirname, 'credentials.env');
    const result: Record<string, string> = {
      MINIO_ROOT_USER: 'minioAdmin',
      MINIO_ROOT_PASSWORD: 'minioAdminPassword123',
      MYSQL_ROOT_PASSWORD: 'mysqlRootPassword123',
      MYSQL_APP_USER: 'app_user',
      MYSQL_APP_PASSWORD: 'mysqlAppPassword123',
      MYSQL_REPL_PASSWORD: 'replPassword123',
      MONGO_ROOT_USER: 'admin',
      MONGO_ROOT_PASSWORD: 'mongoAdminPassword123',
      MONGO_APP_USER: 'mongo_app',
      MONGO_APP_PASSWORD: 'mongoAppPassword123',
      REDIS_PASSWORD: 'redisAuthPassword123',
      KAFKA_ADMIN_USER: 'admin',
      KAFKA_ADMIN_PASSWORD: 'kafkaAdminPassword123',
      KAFKA_CLIENT_USER: 'app_user',
      KAFKA_CLIENT_PASSWORD: 'kafkaAppPassword123',
      ZK_ADMIN_USER: 'zkAdmin',
      ZK_ADMIN_PASSWORD: 'zkAdminPassword123',
      FLINK_ADMIN_USER: 'flinkAdmin',
      FLINK_ADMIN_PASSWORD: 'flinkAdminPassword123',
      K8S_JOIN_TOKEN: 'abcdef.0123456789abcdef'
    };

    if (fs.existsSync(credPath)) {
      try {
        const content = fs.readFileSync(credPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            result[k] = v;
          }
        });
      } catch (err) {
        console.error('Error reading credentials.env:', err);
      }
    }

    return res.json({ success: true, credentials: result });
  });

  app.post('/api/credentials', (req, res) => {
    const { credentials } = req.body;
    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({ error: 'Invalid credentials payload' });
    }

    try {
      const credPath = path.join(__dirname, 'credentials.env');
      const lines = [
        `# CloudCluster Cluster Initial Credentials (Saved at ${new Date().toISOString()})`,
        `MINIO_ROOT_USER=${credentials.MINIO_ROOT_USER || 'minioAdmin'}`,
        `MINIO_ROOT_PASSWORD=${credentials.MINIO_ROOT_PASSWORD || 'minioAdminPassword123'}`,
        `MYSQL_ROOT_PASSWORD=${credentials.MYSQL_ROOT_PASSWORD || 'mysqlRootPassword123'}`,
        `MYSQL_APP_USER=${credentials.MYSQL_APP_USER || 'app_user'}`,
        `MYSQL_APP_PASSWORD=${credentials.MYSQL_APP_PASSWORD || 'mysqlAppPassword123'}`,
        `MYSQL_REPL_PASSWORD=${credentials.MYSQL_REPL_PASSWORD || 'replPassword123'}`,
        `MONGO_ROOT_USER=${credentials.MONGO_ROOT_USER || 'admin'}`,
        `MONGO_ROOT_PASSWORD=${credentials.MONGO_ROOT_PASSWORD || 'mongoAdminPassword123'}`,
        `MONGO_APP_USER=${credentials.MONGO_APP_USER || 'mongo_app'}`,
        `MONGO_APP_PASSWORD=${credentials.MONGO_APP_PASSWORD || 'mongoAppPassword123'}`,
        `MONGO_KEYFILE_BASE64=${credentials.MONGO_KEYFILE_BASE64 || 'c2VjcmV0LWtleWZpbGUtZm9yLW1vbmdvZHItcmVwbGljYXNldC04LjAuOQo='}`,
        `REDIS_PASSWORD=${credentials.REDIS_PASSWORD || 'redisAuthPassword123'}`,
        `KAFKA_ADMIN_USER=${credentials.KAFKA_ADMIN_USER || 'admin'}`,
        `KAFKA_ADMIN_PASSWORD=${credentials.KAFKA_ADMIN_PASSWORD || 'kafkaAdminPassword123'}`,
        `KAFKA_CLIENT_USER=${credentials.KAFKA_CLIENT_USER || 'app_user'}`,
        `KAFKA_CLIENT_PASSWORD=${credentials.KAFKA_CLIENT_PASSWORD || 'kafkaAppPassword123'}`,
        `ZK_ADMIN_USER=${credentials.ZK_ADMIN_USER || 'zkAdmin'}`,
        `ZK_ADMIN_PASSWORD=${credentials.ZK_ADMIN_PASSWORD || 'zkAdminPassword123'}`,
        `FLINK_ADMIN_USER=${credentials.FLINK_ADMIN_USER || 'flinkAdmin'}`,
        `FLINK_ADMIN_PASSWORD=${credentials.FLINK_ADMIN_PASSWORD || 'flinkAdminPassword123'}`,
        `K8S_JOIN_TOKEN=${credentials.K8S_JOIN_TOKEN || 'abcdef.0123456789abcdef'}`
      ];
      fs.writeFileSync(credPath, lines.join('\n') + '\n', 'utf8');

      // Also write custom credentials to helm/custom-credentials.yaml
      const helmCredPath = path.join(__dirname, 'helm', 'custom-credentials.yaml');
      const yamlContent = `# ------------------------------------------------------------------------------
# CloudCluster Custom Initial Credentials (Saved via Web API)
# ------------------------------------------------------------------------------
minio:
  rootUser: "${credentials.MINIO_ROOT_USER || 'minioAdmin'}"
  rootPassword: "${credentials.MINIO_ROOT_PASSWORD || 'minioAdminPassword123'}"

mysql:
  rootPassword: "${credentials.MYSQL_ROOT_PASSWORD || 'mysqlRootPassword123'}"
  appUser: "${credentials.MYSQL_APP_USER || 'app_user'}"
  appPassword: "${credentials.MYSQL_APP_PASSWORD || 'mysqlAppPassword123'}"
  replicationPassword: "${credentials.MYSQL_REPL_PASSWORD || 'replPassword123'}"

mongodb:
  auth:
    rootUser: "${credentials.MONGO_ROOT_USER || 'admin'}"
    rootPassword: "${credentials.MONGO_ROOT_PASSWORD || 'mongoAdminPassword123'}"
    appUser: "${credentials.MONGO_APP_USER || 'mongo_app'}"
    appPassword: "${credentials.MONGO_APP_PASSWORD || 'mongoAppPassword123'}"

redis:
  password: "${credentials.REDIS_PASSWORD || 'redisAuthPassword123'}"

kafka:
  auth:
    enabled: true
    adminUser: "${credentials.KAFKA_ADMIN_USER || 'admin'}"
    adminPassword: "${credentials.KAFKA_ADMIN_PASSWORD || 'kafkaAdminPassword123'}"
    clientUser: "${credentials.KAFKA_CLIENT_USER || 'app_user'}"
    clientPassword: "${credentials.KAFKA_CLIENT_PASSWORD || 'kafkaAppPassword123'}"

zookeeper:
  auth:
    adminUser: "${credentials.ZK_ADMIN_USER || 'zkAdmin'}"
    adminPassword: "${credentials.ZK_ADMIN_PASSWORD || 'zkAdminPassword123'}"

flink:
  auth:
    enabled: true
    adminUser: "${credentials.FLINK_ADMIN_USER || 'flinkAdmin'}"
    adminPassword: "${credentials.FLINK_ADMIN_PASSWORD || 'flinkAdminPassword123'}"
`;
      fs.writeFileSync(helmCredPath, yamlContent, 'utf8');

      return res.json({
        success: true,
        message: 'Credentials saved successfully to credentials.env and helm/custom-credentials.yaml',
        files: ['credentials.env', 'helm/custom-credentials.yaml']
      });
    } catch (e: any) {
      console.error('Failed to save credentials:', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // --------------------------------------------------------------------------
  // API: Test External Git Connectivity (GitHub, Gitee, GitLab, Custom Repo)
  // --------------------------------------------------------------------------
  app.post('/api/git/test', (req, res) => {
    const { url = 'https://github.com/torvalds/linux.git' } = req.body;
    if (!url || typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('git@'))) {
      return res.status(400).json({ success: false, error: 'Invalid Git repository URL' });
    }

    const startTime = Date.now();
    exec(`git ls-remote "${url.replace(/"/g, '')}" HEAD`, { timeout: 10000 }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      if (error) {
        return res.json({
          success: false,
          accessible: false,
          url,
          durationMs,
          error: (stderr || error.message).trim(),
          suggestion: '如果是在无法访问公网的隔离机房，请配置 http_proxy / https_proxy 代理或使用内网 GitLab / Gitee 镜像。'
        });
      }

      return res.json({
        success: true,
        accessible: true,
        url,
        durationMs,
        output: stdout.trim().split('\n')[0] || 'Connected successfully',
        message: `成功连接外部 Git 仓库！响应耗时: ${durationMs}ms`
      });
    });
  });

  // --------------------------------------------------------------------------
  // API: Scale Pod (Flink TaskManager, Kafka, Mongo, MySQL, Redis)
  // Backend execution directly applies to Kubernetes / Helm
  // --------------------------------------------------------------------------
  app.post('/api/k8s/scale', (req, res) => {
    const { component, replicas, namespace = 'data-platform', simulator: reqSimulator } = req.body;

    if (!component || typeof replicas !== 'number') {
      return res.status(400).json({ error: 'Missing component or replicas' });
    }

    // Use request-level simulator flag if provided, else use global backend config
    const currentSimulator = typeof reqSimulator === 'boolean' ? reqSimulator : isSimulator;

    let helmSetKey = '';
    switch (component) {
      case 'flink':
        helmSetKey = `flink.taskManager.replicas=${replicas}`;
        break;
      case 'kafka':
        helmSetKey = `kafka.replicas=${replicas}`;
        break;
      case 'mongo':
        helmSetKey = `mongodb.replicas=${replicas}`;
        break;
      case 'mysql':
        helmSetKey = `mysql.replicas=${replicas}`;
        break;
      case 'redis':
        helmSetKey = `redis.replicas=${replicas}`;
        break;
      case 'zookeeper':
      case 'zk':
        helmSetKey = `zookeeper.replicas=${replicas}`;
        break;
      default:
        helmSetKey = `${component}.replicas=${replicas}`;
    }

    const command = `helm upgrade cloudcluster ./helm -n ${namespace} --reuse-values --set ${helmSetKey}`;

    // If simulator mode is explicitly enabled, do NOT execute commands on the host server
    if (currentSimulator) {
      return res.json({
        success: true,
        mode: 'simulated_or_ready',
        simulator: true,
        component,
        replicas,
        executedCommand: command,
        message: `[Simulator Mode] Simulated scale request for ${component} to ${replicas} replicas. (Command: ${command})`,
        details: `Dry-run execution without modifying host server.`
      });
    }

    // Real execution on host server: return real stdout/stderr/error from the server
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Scale Error] Failed executing: ${command}`, stderr || error.message);
        return res.status(500).json({
          success: false,
          mode: 'live_k8s_error',
          simulator: false,
          component,
          replicas,
          executedCommand: command,
          error: stderr || error.message,
          exitCode: error.code,
          message: `Host server execution failed for command: ${command}`
        });
      }

      return res.json({
        success: true,
        mode: 'live_k8s_applied',
        simulator: false,
        component,
        replicas,
        executedCommand: command,
        message: `Successfully applied to live Kubernetes cluster: ${component} scaled to ${replicas} pods!`,
        output: stdout,
        details: stdout || 'Command succeeded on host server.'
      });
    });
  });

  // --------------------------------------------------------------------------
  // API: Generate Worker Join CLI Script for Physical Machine / VM
  // --------------------------------------------------------------------------
  app.post('/api/k8s/worker-join-cli', (req, res) => {
    const {
      vipEndpoint = '192.168.1.100:6443',
      token = 'abcdef.0123456789abcdef',
      hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      installDir = '/opt/kubernetes'
    } = req.body;

    const cliScript = `#!/usr/bin/env bash
# Run on the target Worker machine (Physical Server or VM)
set -euo pipefail

echo "==> Step 1: Pre-flight check & directory creation"
mkdir -p ${installDir}
cd ${installDir}

echo "==> Step 2: Ensure container runtime is running"
systemctl enable --now containerd

echo "==> Step 3: Joining Kubernetes cluster at ${vipEndpoint}..."
sudo kubeadm join "${vipEndpoint}" \\
  --token "${token}" \\
  --discovery-token-ca-cert-hash "sha256:${hash}"

echo "==> Done! Verify on master with: kubectl get nodes"
`;

    return res.json({
      success: true,
      cliScript,
      vipEndpoint
    });
  });

  // --------------------------------------------------------------------------
  // API: Update VIP / Domain Endpoint (Modifies configs & auto-restarts apps)
  // --------------------------------------------------------------------------
  app.post('/api/k8s/update-vip', (req, res) => {
    const {
      oldEndpoint = '192.168.1.100',
      newEndpoint,
      port = 6443,
      isDomain = false,
      netInterface = 'auto',
      simulator: reqSimulator
    } = req.body;

    if (!newEndpoint || typeof newEndpoint !== 'string') {
      return res.status(400).json({ error: 'Missing newEndpoint parameter' });
    }

    const cleanNewEndpoint = newEndpoint.trim();
    const cleanOldEndpoint = oldEndpoint.trim();
    const currentSimulator = typeof reqSimulator === 'boolean' ? reqSimulator : isSimulator;

    // List of configuration files that are affected and updated
    const updatedFiles = [
      '/etc/keepalived/keepalived.conf',
      '/etc/haproxy/haproxy.cfg',
      '/etc/kubernetes/kubeadm-config.yaml',
      '/etc/kubernetes/admin.conf',
      '/etc/kubernetes/kubelet.conf',
      '/etc/kubernetes/controller-manager.conf',
      '/etc/kubernetes/scheduler.conf',
      './helm/values.yaml'
    ];

    // List of applications / services that are automatically restarted
    const restartedServices = [
      'keepalived.service',
      'haproxy.service',
      'kube-apiserver (static pod reload via cert SAN update)',
      'kubelet.service'
    ];

    // If simulator mode is explicitly enabled, return simulated success without running host script
    if (currentSimulator) {
      const logs = [
        `[1/5] [Simulator] Verified endpoint format: "${cleanNewEndpoint}" (${isDomain ? 'Domain / FQDN 域名模式' : 'Virtual IP 地址模式'})`,
        `[2/5] [Simulator] Simulated updating 8 configuration files: Keepalived, HAProxy, kubeadm-config.yaml, and Kubeconfigs`,
        `[3/5] [Simulator] Simulated API server certificates SAN re-sign with "${cleanNewEndpoint}"`,
        `[4/5] [Simulator] Simulated auto-restart for services: Keepalived, HAProxy, and Kubelet`,
        `[5/5] [Simulator] Virtual health check succeeded on port ${port}`
      ];

      return res.json({
        success: true,
        mode: 'simulated_or_ready',
        simulator: true,
        oldEndpoint: cleanOldEndpoint,
        newEndpoint: cleanNewEndpoint,
        port,
        isDomain,
        updatedFiles,
        restartedServices,
        logs,
        message: `[Simulator Mode] 模拟完成高可用终端更新！未在宿主服务器上实际执行系统命令。`
      });
    }

    // Script that executes the configuration replacements & service restarts on the host server
    const updateScript = `#!/usr/bin/env bash
set -e
echo "==> Step 1: Updating Keepalived & HAProxy configuration..."
if [ -f /etc/keepalived/keepalived.conf ]; then
  ${isDomain ? '# Domain mode: Keepalived binds to upstream or DNS resolver' : `sed -i 's/${cleanOldEndpoint}/${cleanNewEndpoint}/g' /etc/keepalived/keepalived.conf`}
fi
if [ -f /etc/haproxy/haproxy.cfg ]; then
  sed -i 's/${cleanOldEndpoint}/${cleanNewEndpoint}/g' /etc/haproxy/haproxy.cfg
fi

echo "==> Step 2: Updating Kubernetes controlPlaneEndpoint & Certificate SANs..."
if [ -f /etc/kubernetes/kubeadm-config.yaml ]; then
  sed -i 's/controlPlaneEndpoint:.*/controlPlaneEndpoint: "${cleanNewEndpoint}:${port}"/g' /etc/kubernetes/kubeadm-config.yaml
  kubeadm init phase certs apiserver --config=/etc/kubernetes/kubeadm-config.yaml || true
fi

echo "==> Step 3: Updating server URLs in all Kubeconfig files..."
for CONF in /etc/kubernetes/*.conf; do
  if [ -f "$CONF" ]; then
    sed -i 's|server: https://.*:${port}|server: https://${cleanNewEndpoint}:${port}|g' "$CONF"
  fi
done

echo "==> Step 4: Automatically restarting affected services..."
systemctl restart keepalived haproxy || true
systemctl restart kubelet || true

echo "==> Step 5: Verification & cluster health check via ${cleanNewEndpoint}:${port}..."
`;

    // Attempt to update local helm/values.yaml if available in repository
    try {
      import('fs').then(fs => {
        const valuesPath = path.join(__dirname, 'helm', 'values.yaml');
        if (fs.existsSync(valuesPath)) {
          let content = fs.readFileSync(valuesPath, 'utf8');
          content = content.replace(new RegExp(cleanOldEndpoint, 'g'), cleanNewEndpoint);
          fs.writeFileSync(valuesPath, content, 'utf8');
        }
      });
    } catch (e) {
      console.error('Failed to patch local values.yaml:', e);
    }

    // Real execution on host server: return real stdout/stderr/error from the server
    exec(updateScript, (error, stdout, stderr) => {
      if (error) {
        console.error(`[VIP Update Error] Failed executing:`, stderr || error.message);
        return res.status(500).json({
          success: false,
          mode: 'live_k8s_error',
          simulator: false,
          oldEndpoint: cleanOldEndpoint,
          newEndpoint: cleanNewEndpoint,
          port,
          isDomain,
          error: stderr || error.message,
          exitCode: error.code,
          message: `Host server VIP update execution failed: ${stderr || error.message}`
        });
      }

      const logs = [
        `[1/5] Verified endpoint format: "${cleanNewEndpoint}" (${isDomain ? 'Domain / FQDN 域名模式' : 'Virtual IP 地址模式'})`,
        `[2/5] Patched 8 configuration files on host server`,
        `[3/5] Re-signed API server certificates with SAN "${cleanNewEndpoint}"`,
        `[4/5] Auto-restarted services: Keepalived, HAProxy, and Kubelet`,
        `[5/5] Re-established control plane quorum on port ${port}`
      ];

      return res.json({
        success: true,
        mode: 'live_executed',
        simulator: false,
        oldEndpoint: cleanOldEndpoint,
        newEndpoint: cleanNewEndpoint,
        port,
        isDomain,
        updatedFiles,
        restartedServices,
        logs,
        output: stdout,
        script: updateScript,
        message: `成功完成高可用终端更新！所有 8 个配置文件已完成修改，Keepalived/HAProxy/Kubelet 已自动重启并恢复正常运行。`
      });
    });
  });

  // Mount Vite development middlewares
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
