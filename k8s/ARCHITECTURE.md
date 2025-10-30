# Kubernetes Monitoring & Logging Architecture

Complete explanation of each file in the monitoring and logging stack, how they work together, and their role in the system.

---

## 📋 Table of Contents

1. [Monitoring Stack Files](#monitoring-stack-files)
2. [Logging Stack Files](#logging-stack-files)
3. [How Components Work Together](#how-components-work-together)
4. [Data Flow](#data-flow)
5. [Storage & Persistence](#storage--persistence)
6. [Networking & Services](#networking--services)

---

## 🔍 Monitoring Stack Files

### Prometheus Files

#### 1. `prometheus-deployment.yaml`

**Role:** Defines the Prometheus server container

**What it does:**
- Creates a Deployment that runs Prometheus in a container
- Configures resource limits (CPU: 200m-500m, Memory: 512Mi-1Gi)
- Mounts two ConfigMaps:
  - `prometheus-config`: Main configuration file
  - `prometheus-rules`: Alert rules
- Mounts a PVC for persistent storage
- Sets up health probes (liveness and readiness)

**Key configurations:**
```yaml
args:
  - '--config.file=/etc/prometheus/prometheus.yml'  # Location of config
  - '--storage.tsdb.path=/prometheus/'              # Where to store data
  - '--storage.tsdb.retention.time=200h'            # Keep 200 hours of data
  - '--web.enable-lifecycle'                        # Allows API reload
```

**How it works:**
1. Prometheus starts and reads `/etc/prometheus/prometheus.yml`
2. It discovers scrape targets based on the config
3. Collects metrics every 15 seconds (scrape_interval)
4. Stores metrics in `/prometheus/` (persisted via PVC)
5. Evaluates alert rules every 15 seconds
6. Sends alerts to AlertManager when conditions are met

---

#### 2. `prometheus-service.yaml`

**Role:** Exposes Prometheus to the network

**What it does:**
- Creates a Service that routes traffic to Prometheus pods
- Exposes Prometheus on port 30090 (NodePort) externally
- Internal port is 9090

**Service Types:**
- **NodePort:** External access via `localhost:30090`
- **ClusterIP (internal):** `prometheus-service:9090` from within cluster

**How it works:**
```
Internet Request → NodePort 30090 → prometheus-service → Prometheus Pod :9090
Cluster Request → prometheus-service:9090 → Prometheus Pod :9090
```

---

#### 3. `prometheus-configmap.yaml`

**Role:** Contains Prometheus configuration

**What it does:**
- Defines scrape targets (what Prometheus should collect metrics from)
- Configures alerting (where to send alerts)
- Specifies alert rule files to load

**Key sections:**

**Global Settings:**
```yaml
global:
  scrape_interval: 15s        # Collect metrics every 15 seconds
  evaluation_interval: 15s    # Check alert rules every 15 seconds
```

**Alerting Configuration:**
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager-service:9093  # Where to send alerts
```

**Scrape Configs (What to Monitor):**

1. **Prometheus itself:**
   ```yaml
   - job_name: 'prometheus'
     static_configs:
       - targets: ['localhost:9090']
   ```

2. **Node Exporter (system metrics):**
   ```yaml
   - job_name: 'node-exporter'
     kubernetes_sd_configs:
       - role: endpoints
   ```
   Automatically discovers Node Exporter service endpoints

3. **Kubernetes Pods:**
   ```yaml
   - job_name: 'kubernetes-pods'
     kubernetes_sd_configs:
       - role: pod
   ```
   Discovers all pods with `prometheus.io/scrape` annotation

4. **Backend/Frontend:**
   - Scrapes metrics from backend-service:3000 and frontend-service:3000

**How it works:**
1. Prometheus reads this config on startup
2. Uses Kubernetes service discovery to find targets
3. Relabels metrics (adds Kubernetes labels like namespace, pod name)
4. Scrapes metrics from discovered targets
5. Stores them in its time-series database

---

#### 4. `prometheus-rules-configmap.yaml`

**Role:** Defines alert conditions and thresholds

**What it does:**
- Contains Prometheus Recording Rules
- Defines alert conditions (when to trigger alerts)
- Sets alert severity levels
- Configures alert annotations (what to show)

**Alert Structure:**
```yaml
- alert: HighCPUUsage                    # Alert name
  expr: 100 - (avg by(instance) ...) > 80  # Condition (PromQL)
  for: 5m                                 # Must be true for 5 minutes
  labels:
    severity: warning                     # Alert level
  annotations:
    summary: "High CPU usage detected"   # What users see
    description: "CPU usage is above 80% on {{ $labels.instance }}"
```

**Alert Rules Included:**
1. **HighCPUUsage** - Triggers when CPU > 80%
2. **HighMemoryUsage** - Triggers when memory > 85%
3. **HighDiskUsage** - Triggers when disk > 85%
4. **PodRestartLoop** - Triggers when pods restart frequently
5. **PodDown** - Triggers when pod is not running
6. **HighErrorRate** - Triggers on high error rates
7. **SlowResponseTime** - Triggers on slow responses

**How it works:**
1. Prometheus evaluates these rules every `evaluation_interval`
2. If a condition is true for `for` duration, alert fires
3. Alert is sent to AlertManager
4. AlertManager routes it based on severity

---

#### 5. `prometheus-pvc.yaml`

**Role:** Persistent storage for Prometheus metrics

**What it does:**
- Requests 20Gi of persistent storage
- Uses `hostpath` storage class (for Docker Desktop)
- Ensures metrics are retained even if Prometheus pod restarts

**How it works:**
1. PVC requests storage from Kubernetes
2. Cluster provisions a PersistentVolume
3. Prometheus mounts it at `/prometheus`
4. All metrics data is written to this volume
5. Data persists across pod deletions and restarts

---

### AlertManager Files

#### 6. `alertmanager-deployment.yaml`

**Role:** Defines the AlertManager container

**What it does:**
- Runs AlertManager service
- Manages alert routing and deduplication
- Sends notifications to configured receivers

**Key configurations:**
```yaml
args:
  - '--config.file=/etc/alertmanager/alertmanager.yml'
  - '--storage.path=/alertmanager/'
```

**How it works:**
1. Receives alerts from Prometheus
2. Groups similar alerts together
3. Deduplicates duplicate alerts
4. Routes alerts to appropriate receivers (email, webhooks, etc.)
5. Handles inhibition (suppresses alerts when other alerts fire)
6. Manages alert states (firing, resolved, silenced)

---

#### 7. `alertmanager-service.yaml`

**Role:** Exposes AlertManager to the network

**What it does:**
- Exposes AlertManager on port 30093 externally
- Internal port is 9093

**How it works:**
- Prometheus connects to `alertmanager-service:9093` to send alerts
- UI accessible at http://localhost:30093

---

#### 8. `alertmanager-configmap.yaml`

**Role:** Contains AlertManager routing configuration

**What it does:**
- Defines how alerts are grouped and routed
- Configures receivers (where to send alerts)
- Sets up inhibition rules

**Configuration Structure:**

**Route Tree:**
```yaml
route:
  group_by: ['alertname', 'cluster', 'service']  # Group alerts by these labels
  group_wait: 10s                                 # Wait 10s before first group
  group_interval: 10s                             # Wait 10s between groups
  repeat_interval: 12h                            # Repeat alert every 12h
  receiver: 'web.hook'                            # Default receiver
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
```

**Receivers:**
```yaml
receivers:
  - name: 'critical-alerts'
    webhook_configs:
      - url: 'http://localhost:5001/'
    # email_configs: ...
    # Additional receivers can be added here
```

**Inhibition Rules:**
```yaml
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
```
Suppresses warning alerts when critical alert is firing

**How it works:**
1. AlertManager receives alert from Prometheus
2. Matches alert against route tree
3. If critical → sends to critical-alerts receiver
4. If warning → sends to warning-alerts receiver
5. Groups alerts by labels to avoid spam
6. If inhibited by another alert → suppresses it

---

#### 9. `alertmanager-pvc.yaml`

**Role:** Persistent storage for AlertManager state

**What it does:**
- Requests 5Gi of storage
- Stores alert state, silences, and inhibition rules
- Persists alert history

---

### Node Exporter Files

#### 10. `node-exporter-daemonset.yaml`

**Role:** Collects system-level metrics from each node

**What it does:**
- Deploys one pod per node (DaemonSet)
- Collects CPU, memory, disk, network metrics
- Exposes metrics on port 9100

**Key configurations:**
```yaml
hostNetwork: true    # Uses host's network
hostPID: true        # Accesses host's process namespace
volumes:
  - name: proc
    hostPath:
      path: /proc     # CPU, process metrics
  - name: sys
    hostPath:
      path: /sys      # System information
  - name: root
    hostPath:
      path: /         # Disk metrics
```

**Tolerations:**
```yaml
tolerations:
  - effect: NoSchedule
    operator: Exists
```
Allows Node Exporter to run on any node (including master nodes)

**Metrics collected:**
- CPU usage, idle time, iowait
- Memory total, available, cached
- Disk space, I/O operations
- Network packets, bytes
- Load average
- File system usage

**How it works:**
1. Runs on every node
2. Accesses host's `/proc` and `/sys` filesystems
3. Exposes metrics on port 9100
4. Prometheus scrapes these metrics
5. Prometheus stores them with `node_` prefix

---

#### 11. `node-exporter-service.yaml`

**Role:** Exposes Node Exporter metrics

**What it does:**
- Exposes Node Exporter on port 30100 externally
- Allows Prometheus to discover and scrape it

---

### Grafana Files

#### 12. `grafana-deployment.yaml`

**Role:** Defines the Grafana visualization platform

**What it does:**
- Runs Grafana container
- Loads datasources from mounted ConfigMap
- Provides web UI for dashboards

**Key configurations:**
```yaml
env:
  - name: GF_SECURITY_ADMIN_USER
    value: "admin"
  - name: GF_SECURITY_ADMIN_PASSWORD
    valueFrom:
      secretKeyRef:
        name: grafana-secrets
        key: admin-password
  - name: GF_INSTALL_PLUGINS
    value: "grafana-clock-panel,grafana-piechart-panel"
```

**Volume mounts:**
- `grafana-storage`: Persistent storage for dashboards and settings
- `grafana-datasources`: Pre-configured Prometheus and Loki connections

**How it works:**
1. Starts Grafana web server on port 3000
2. Loads datasources from ConfigMap
3. User logs in with admin credentials
4. User creates/imports dashboards
5. Dashboards query Prometheus/Loki for data
6. Data is displayed as graphs, tables, etc.

---

#### 13. `grafana-service.yaml`

**Role:** Exposes Grafana to the network

**What it does:**
- Exposes Grafana on port 30092 externally
- Internal port is 3000

---

#### 14. `grafana-datasources-configmap.yaml`

**Role:** Pre-configures Prometheus and Loki as data sources

**What it does:**
- Automatically adds Prometheus and Loki to Grafana
- Saves manual configuration effort
- Uses Kubernetes service names for connection

**Configuration:**
```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus-service:9090  # Internal service name
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki-service:3100
```

**How it works:**
1. Mounted as a file in Grafana container
2. Grafana reads it on startup
3. Automatically configures data sources
4. Users can immediately start creating dashboards

---

#### 15. `grafana-secrets.yaml`

**Role:** Stores Grafana admin credentials securely

**What it does:**
- Creates a Kubernetes Secret
- Stores admin password
- Referenced by Grafana deployment

**Default credentials:**
- Username: `admin`
- Password: `admin` (change after first login!)

---

#### 16. `grafana-pvc.yaml`

**Role:** Persistent storage for Grafana data

**What it does:**
- Requests 10Gi of storage
- Stores dashboards, user preferences, and plugin data
- Persists across pod restarts

---

## 📝 Logging Stack Files

### Loki Files

#### 17. `loki-deployment.yaml`

**Role:** Defines the Loki log aggregation server

**What it does:**
- Runs Loki container
- Receives and stores logs from Promtail
- Provides API for log queries

**Key configurations:**
```yaml
args:
  - -config.file=/etc/loki/loki-config.yaml
```

**How it works:**
1. Starts Loki server on port 3100
2. Receives log streams from Promtail
3. Stores logs in chunks
4. Indexes logs by labels
5. Provides query API for retrieving logs
6. Manages log retention (deletes old logs)

---

#### 18. `loki-service.yaml`

**Role:** Exposes Loki API

**What it does:**
- Exposes Loki on port 30310 externally
- Internal port is 3100

---

#### 19. `loki-configmap.yaml`

**Role:** Contains Loki configuration

**Key settings:**

**Storage:**
```yaml
schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper        # Storage backend
      object_store: filesystem     # Use local filesystem
      schema: v11
```

**Retention:**
```yaml
table_manager:
  retention_deletes_enabled: true
  retention_period: 720h          # Keep logs for 30 days
```

**Limits:**
```yaml
limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 16          # Max ingestion rate
```

**How it works:**
1. Stores logs in `/loki/chunks` and `/loki/rules`
2. Uses BoltDB for indexing
3. Automatically deletes logs older than retention period
4. Enforces rate limits to prevent overload

---

#### 20. `loki-pvc.yaml`

**Role:** Persistent storage for Loki logs

**What it does:**
- Requests 20Gi of storage
- Stores log data and indexes
- Retains logs across pod restarts

---

### Promtail Files

#### 21. `promtail-daemonset.yaml`

**Role:** Collects logs from each node

**What it does:**
- Deploys one pod per node (DaemonSet)
- Scrapes log files from Kubernetes pods
- Sends logs to Loki

**Key configurations:**
```yaml
volumeMounts:
  - name: varlog
    mountPath: /var/log              # Kubernetes pod logs
  - name: varlibdockercontainers
    mountPath: /var/lib/docker/containers  # Docker logs
```

**How it works:**
1. Runs on every node
2. Uses Kubernetes API to discover pods
3. Reads log files from `/var/log/pods/`
4. Adds labels (namespace, pod name, container name)
5. Sends labeled logs to Loki
6. Parses JSON logs if configured

---

#### 22. `promtail-service.yaml`

**Role:** Exposes Promtail metrics

**What it does:**
- Exposes Promtail on port 9080
- Provides metrics about log collection

---

#### 23. `promtail-configmap.yaml`

**Role:** Contains Promtail collection configuration

**What it does:**
- Defines what logs to collect
- Configures where to send logs
- Sets up label rules

**Configuration Structure:**

**Client:**
```yaml
clients:
  - url: http://loki-service:3100/loki/api/v1/push
```
Sends logs to Loki

**Scrape Configs:**

1. **Kubernetes Pods:**
   ```yaml
   - job_name: kubernetes-pods
     kubernetes_sd_configs:
       - role: pod
     relabel_configs:
       - action: labelmap
         regex: __meta_kubernetes_pod_label_(.+)
   ```
   Automatically discovers all pods and their labels

2. **Docker Logs:**
   ```yaml
   - job_name: docker
     docker_sd_configs:
       - host: unix:///var/run/docker.sock
   ```
   Collects Docker container logs

3. **Backend/Frontend:**
   ```yaml
   - job_name: backend
     static_configs:
       - targets:
           - localhost
         labels:
           job: backend
   ```
   Collects application-specific logs

**How it works:**
1. Discovers pods via Kubernetes API
2. Reads log files from host filesystem
3. Applies labels based on pod metadata
4. Parses logs using pipeline stages
5. Sends labeled logs to Loki

---

#### 24. `promtail-serviceaccount.yaml`

**Role:** Provides RBAC permissions for Promtail

**What it does:**
- Creates ServiceAccount for Promtail
- Creates ClusterRole with necessary permissions
- Binds permissions to ServiceAccount

**Permissions needed:**
```yaml
rules:
  - apiGroups: [""]
    resources:
      - nodes
      - services
      - endpoints
      - pods
    verbs: ["get", "list", "watch"]
```

**Why needed:**
- Promtail uses Kubernetes API to discover pods
- Needs to read pod metadata to label logs
- Gets list of all pods in cluster

**How it works:**
1. Kubernetes API validates requests
2. Checks if ServiceAccount has permissions
3. Allows Promtail to read pod information
4. Promtail can discover and label logs

---

## 🔗 How Components Work Together

### Monitoring Flow

```
┌─────────────────┐
│ Node Exporter   │ Collects system metrics (CPU, memory, disk)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Prometheus     │ Scrapes metrics every 15s
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌──────────────┐  ┌─────────────────┐
│ Grafana      │  │  AlertManager   │
│ (Queries)    │  │  (Receives)     │
└──────────────┘  └─────────┬───────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ Email/Webhooks  │
                   └─────────────────┘
```

1. **Node Exporter** runs on each node
2. **Prometheus** scrapes Node Exporter metrics
3. **Prometheus** evaluates alert rules
4. If alert fires → sends to **AlertManager**
5. **AlertManager** routes and sends notifications
6. **Grafana** queries Prometheus to display dashboards

### Logging Flow

```
┌─────────────────┐
│ Kubernetes Pods │ Write logs to /var/log/pods/
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Promtail      │ Reads logs, adds labels
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│      Loki       │ Stores and indexes logs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Grafana      │ Queries and displays logs
└─────────────────┘
```

1. **Pods** write logs to filesystem
2. **Promtail** reads logs from host filesystem
3. **Promtail** adds labels (namespace, pod, container)
4. **Promtail** sends to **Loki**
5. **Loki** stores and indexes logs
6. **Grafana** queries Loki to display logs

---

## 📊 Data Flow

### Metrics Collection

1. **Discovery:** Prometheus uses Kubernetes service discovery
2. **Scraping:** Connects to target endpoints
3. **Collection:** Retrieves metrics in Prometheus format
4. **Storage:** Writes to time-series database
5. **Query:** Grafana queries Prometheus via PromQL
6. **Visualization:** Grafana renders charts and dashboards

### Alert Processing

1. **Evaluation:** Prometheus evaluates alert rules every 15s
2. **Condition:** Checks if metric threshold is exceeded
3. **Duration:** Waits for `for` duration
4. **Trigger:** Sends alert to AlertManager
5. **Grouping:** AlertManager groups similar alerts
6. **Routing:** Routes to appropriate receiver
7. **Notification:** Sends email, webhooks, etc.

### Log Collection

1. **Discovery:** Promtail uses Kubernetes API to find pods
2. **Reading:** Reads log files from `/var/log/pods/`
3. **Labeling:** Adds pod, namespace, container labels
4. **Parsing:** Parses JSON logs if configured
5. **Streaming:** Sends log streams to Loki
6. **Storage:** Loki stores in chunks with index
7. **Query:** Grafana queries via LogQL
8. **Display:** Shows logs in table or graph

---

## 💾 Storage & Persistence

### PersistentVolumeClaim (PVC)

**Purpose:** Request persistent storage from cluster

**Storage Classes:**
- `hostpath`: Docker Desktop (local filesystem)
- `standard`: Cloud providers (EBS, PD, etc.)
- `fast-ssd`: High-performance storage

**Components with PVCs:**
1. Prometheus: 20Gi (metrics data)
2. AlertManager: 5Gi (alert state)
3. Grafana: 10Gi (dashboards, users)
4. Loki: 20Gi (log data)

**How it works:**
1. PVC requests storage
2. Kubernetes provisions a PersistentVolume
3. Pod mounts PVC as volume
4. Data persists across pod restarts
5. Can survive pod deletion

### Data Retention

**Prometheus:**
- Default: 200 hours (~8 days)
- Configurable via `--storage.tsdb.retention.time`
- Old data automatically deleted

**Loki:**
- Default: 720 hours (30 days)
- Configurable in `loki-configmap.yaml`
- Old logs automatically deleted

---

## 🌐 Networking & Services

### Service Types

**NodePort:**
- External access via `localhost:<nodePort>`
- Used for: Prometheus, Grafana, AlertManager, Loki
- Example: `localhost:30090` → Prometheus

**ClusterIP:**
- Internal access only
- Used for: Service-to-service communication
- Example: `prometheus-service:9090`

**How It Works:**
```
External:
Browser → localhost:30090 → NodePort → Service → Pod:9090

Internal:
Pod → prometheus-service:9090 → Service → Prometheus Pod:9090
```

### DNS Resolution

Kubernetes creates DNS names for services:
- Service name: `prometheus-service`
- Namespace: `travelmemory`
- Full DNS: `prometheus-service.travelmemory.svc.cluster.local`
- Shorthand: `prometheus-service` (within same namespace)

**This is why configs use service names:**
```yaml
# Grafana datasource config
url: http://prometheus-service:9090  # Not IP address!
```

---

## 🔧 Key Concepts

### DaemonSet vs Deployment

**DaemonSet:**
- Runs one pod per node
- Used for: Node Exporter, Promtail
- Must run on every node

**Deployment:**
- Can run multiple replicas
- Kubernetes can reschedule pods
- Used for: Prometheus, Grafana, Loki

### ConfigMap vs Secret

**ConfigMap:**
- Non-sensitive data
- Used for: Prometheus config, rules, datasources
- Mounted as files or injected as env vars

**Secret:**
- Sensitive data (base64 encoded)
- Used for: Passwords, API keys
- Grafana admin password stored here

### Health Probes

**Liveness Probe:**
- "Is the process alive?"
- If fails → restart pod
- Example: Check `/health` endpoint

**Readiness Probe:**
- "Can the pod serve traffic?"
- If fails → remove from load balancer
- Example: Check `/ready` endpoint

---

## 🎯 Summary

### What Each Stack Provides

**Monitoring Stack:**
- ✅ Real-time metrics collection
- ✅ Alerting on thresholds
- ✅ Visual dashboards
- ✅ Historical data retention

**Logging Stack:**
- ✅ Centralized log aggregation
- ✅ Log search and filtering
- ✅ Correlated logs with metrics
- ✅ Historical log queries

### How They Work Together

1. **Prometheus** collects metrics → sends alerts
2. **AlertManager** manages alerts → sends notifications
3. **Grafana** visualizes both metrics and logs
4. **Loki** stores logs → provides to Grafana
5. **Promtail** collects logs → sends to Loki
6. **Node Exporter** provides system metrics

All components use Kubernetes Services for internal communication, PVCs for persistence, and ConfigMaps/Secrets for configuration.

---

## 📚 References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Kubernetes Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
