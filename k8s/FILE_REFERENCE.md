# File Reference Guide

Quick reference guide explaining the role of each file in the monitoring and logging stack.

---

## 📁 Prometheus Stack (5 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `prometheus-deployment.yaml` | Defines Prometheus server container | Scrapes every 15s, stores for 200h |
| `prometheus-service.yaml` | Exposes Prometheus externally | Port 30090 |
| `prometheus-configmap.yaml` | Scrape targets and discovery config | Auto-discovers Kubernetes pods |
| `prometheus-rules-configmap.yaml` | Alert conditions and thresholds | CPU/Memory/Disk alerts |
| `prometheus-pvc.yaml` | Persistent storage for metrics | 20Gi |

**What it does:** Collects metrics from all services and evaluates alert rules.

---

## 📁 AlertManager Stack (4 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `alertmanager-deployment.yaml` | Alert routing and notification service | Manages alert state |
| `alertmanager-service.yaml` | Exposes AlertManager externally | Port 30093 |
| `alertmanager-configmap.yaml` | Alert routing and receivers | Routes to email/webhooks |
| `alertmanager-pvc.yaml` | Persistent storage for alerts | 5Gi |

**What it does:** Receives alerts from Prometheus and routes them to email, webhooks, etc.

---

## 📁 Node Exporter (2 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `node-exporter-daemonset.yaml` | System metrics collector (runs on each node) | Collects CPU, memory, disk |
| `node-exporter-service.yaml` | Exposes Node Exporter | Port 30100 |

**What it does:** Collects system-level metrics (CPU, memory, disk) from each node.

---

## 📁 Grafana Stack (5 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `grafana-deployment.yaml` | Visualization platform | Displays dashboards |
| `grafana-service.yaml` | Exposes Grafana externally | Port 30092 |
| `grafana-datasources-configmap.yaml` | Pre-configures Prometheus & Loki | Auto-setup on first run |
| `grafana-secrets.yaml` | Admin credentials | Username: admin, Password: admin |
| `grafana-pvc.yaml` | Persistent storage for dashboards | 10Gi |

**What it does:** Provides web UI for creating dashboards and viewing metrics/logs.

---

## 📁 Loki Stack (4 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `loki-deployment.yaml` | Log aggregation server | Receives logs from Promtail |
| `loki-service.yaml` | Exposes Loki API | Port 30310 |
| `loki-configmap.yaml` | Storage and retention settings | 30-day retention |
| `loki-pvc.yaml` | Persistent storage for logs | 20Gi |

**What it does:** Receives, stores, and indexes logs from all applications.

---

## 📁 Promtail Stack (4 files)

| File | Role | Key Configuration |
|------|------|-------------------|
| `promtail-daemonset.yaml` | Log collector (runs on each node) | Reads pod logs |
| `promtail-service.yaml` | Exposes Promtail metrics | Internal only |
| `promtail-configmap.yaml` | Log collection rules | What logs to collect |
| `promtail-serviceaccount.yaml` | RBAC permissions | Access to Kubernetes API |

**What it does:** Reads logs from pods and sends them to Loki.

---

## 🔄 Data Flow Summary

```
Monitoring:
Node Exporter → Prometheus → Grafana (visualize)
                     ↓
              AlertManager → Email/Webhooks

Logging:
Pods → Promtail → Loki → Grafana (view logs)
```

---

## 📊 Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | http://localhost:30092 | Dashboards (admin/admin) |
| Prometheus | http://localhost:30090 | Metrics & queries |
| AlertManager | http://localhost:30093 | Alert management |
| Node Exporter | http://localhost:30100 | System metrics |
| Loki | http://localhost:30310 | Log API |

---

## 🎯 Quick Actions

### View All Metrics
→ Grafana: http://localhost:30092

### Query Metrics
→ Prometheus: http://localhost:30090

### View Logs
→ Grafana Explore → Select Loki → Query logs

### Check Alerts
→ AlertManager: http://localhost:30093

### Update Configuration
1. Edit ConfigMap file
2. Apply: `kubectl apply -f <file>`
3. Restart: `kubectl rollout restart deployment <name>`

---

## 🔧 Common File Patterns

### Deployment Files
- Always include: replicas, selector, template, containers
- Usually include: resources, probes, volumes

### Service Files
- Always include: selector, ports
- Type: NodePort (external) or ClusterIP (internal)

### ConfigMap Files
- Contains configuration data
- Mounted as files or injected as env vars

### PVC Files
- Requests persistent storage
- Specifies: size, access mode, storage class

### DaemonSet Files
- Similar to Deployment but runs one pod per node
- Used for system-level collectors

---

## 📚 Need More Detail?

- **Architecture:** See `ARCHITECTURE.md` for detailed explanations
- **Setup:** See `MONITORING.md` for deployment guide
- **Application:** See `README.md` for main application deployment
