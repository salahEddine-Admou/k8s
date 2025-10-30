# Monitoring & Logging Stack Setup Guide

Complete guide for deploying Prometheus, Grafana, AlertManager, Node Exporter, Loki, and Promtail on Kubernetes.

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monitoring Stack                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │  Prometheus  │────────▶│  Grafana     │                      │
│  │  :9090       │         │  :3000       │                      │
│  └──────┬───────┘         └──────────────┘                      │
│         │                                                       │
│         └──────────┐                                           │
│                    ▼                                           │
│         ┌──────────────────┐                                  │
│         │  AlertManager    │                                  │
│         │  :9093           │                                  │
│         └──────────────────┘                                  │
│                    │                                           │
│                    ▼                                           │
│         ┌──────────────────┐                                  │
│         │  Email/Webhooks  │                                  │
│         └──────────────────┘                                  │
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │Node Exporter │────────▶│  Prometheus  │                      │
│  │  :9100       │         │              │                      │
│  └──────────────┘         └──────────────┘                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                          Logging Stack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │  Promtail    │────────▶│     Loki     │────────▶Grafana     │
│  │  (DaemonSet) │         │  :3100       │      (Log Viewing)  │
│  └──────────────┘         └──────────────┘                      │
│                                                                  │
│  Collects logs from:                                            │
│  - All Kubernetes pods                                          │
│  - Docker containers                                            │
│  - System logs                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Deploy Monitoring Stack

```bash
cd k8s

# Deploy all monitoring resources
kubectl apply -f prometheus-pvc.yaml
kubectl apply -f prometheus-configmap.yaml
kubectl apply -f prometheus-rules-configmap.yaml
kubectl apply -f prometheus-deployment.yaml
kubectl apply -f prometheus-service.yaml

kubectl apply -f alertmanager-pvc.yaml
kubectl apply -f alertmanager-configmap.yaml
kubectl apply -f alertmanager-deployment.yaml
kubectl apply -f alertmanager-service.yaml

kubectl apply -f node-exporter-daemonset.yaml
kubectl apply -f node-exporter-service.yaml

kubectl apply -f grafana-secrets.yaml
kubectl apply -f grafana-datasources-configmap.yaml
kubectl apply -f grafana-pvc.yaml
kubectl apply -f grafana-deployment.yaml
kubectl apply -f grafana-service.yaml
```

### 2. Deploy Logging Stack

```bash
kubectl apply -f loki-pvc.yaml
kubectl apply -f loki-configmap.yaml
kubectl apply -f loki-deployment.yaml
kubectl apply -f loki-service.yaml


kubectl apply -f promtail-serviceaccount.yaml
kubectl apply -f promtail-configmap.yaml
kubectl apply -f promtail-daemonset.yaml
kubectl apply -f promtail-service.yaml
```

### 3. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n travelmemory

# Check services
kubectl get svc -n travelmemory

# Expected output should show:
# - prometheus-xxx (1/1 Running)
# - alertmanager-xxx (1/1 Running)
# - grafana-xxx (1/1 Running)
# - node-exporter-xxx (1/1 Running)
# - loki-xxx (1/1 Running)
# - promtail-xxx (1/1 Running)
```

### 4. Access Dashboards

- **Grafana:** http://localhost:30092 (admin/admin)
- **Prometheus:** http://localhost:30090
- **AlertManager:** http://localhost:30093
- **Loki:** http://localhost:30310

## 📈 Using Grafana

### Login

1. Navigate to http://localhost:30092
2. Default credentials:
   - Username: `admin`
   - Password: `admin`
3. Change password on first login (recommended)

### Data Sources

Data sources are pre-configured:
- **Prometheus:** `http://prometheus-service:9090`
- **Loki:** `http://loki-service:3100`

To verify:
1. Go to Configuration → Data Sources
2. Both Prometheus and Loki should be listed and tested

### Importing Dashboards

#### 1. Kubernetes Cluster Monitoring (ID: 7249)

```bash
# In Grafana UI:
Dashboards → Import
Paste dashboard ID: 7249
Select: Prometheus (Prometheus) as data source
Click: Import
```

#### 2. Node Exporter Full (ID: 1860)

```bash
Dashboard ID: 1860
Data Source: Prometheus (Prometheus)
```

#### 3. Kubernetes Pod Monitoring (ID: 6417)

```bash
Dashboard ID: 6417
Data Source: Prometheus (Prometheus)
```

#### 4. Loki Logs Dashboard (ID: 13639)

```bash
Dashboard ID: 13639
Data Source: Loki (Loki)
```

### Creating Custom Dashboards

1. Click "Create" → "Dashboard"
2. Add Panel
3. Select Query tab
4. Choose data source (Prometheus or Loki)
5. Write query:
   - Prometheus: PromQL
   - Loki: LogQL
6. Configure visualization
7. Save dashboard

### Sample PromQL Queries

```promql
# CPU usage percentage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage percentage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage percentage
100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100)

# Pod restart count
sum(rate(kube_pod_container_status_restarts_total[5m])) by (pod)

# Network received bytes
rate(node_network_receive_bytes_total[5m])

# Network transmitted bytes
rate(node_network_transmit_bytes_total[5m])
```

## 📝 Using Loki for Logs

### Query Logs in Grafana

1. Click "Explore" in the left menu
2. Select "Loki" data source
3. Write LogQL queries

### Sample LogQL Queries

```logql
# All logs from travelmemory namespace
{namespace="travelmemory"}

# Error logs only
{namespace="travelmemory"} |= "error"

# Backend logs
{job="backend"}

# Frontend logs with errors
{job="frontend"} |= "error"

# Logs from specific pod
{pod="frontend-deployment-xxx"}

# Regex pattern matching
{namespace="travelmemory"} |~ "(?i)error|exception"

# Parse JSON logs
{job="backend"} | json | level="error"

# Count logs by level
{namespace="travelmemory"} | json | count by (level)
```

### View Logs from Command Line

```bash
# View all logs from a pod
kubectl logs -n travelmemory <pod-name> -f

# View logs from backend pods
kubectl logs -n travelmemory -l component=backend -f

# View logs from all pods
kubectl logs -n travelmemory -f --all-containers=true

# View last 100 lines of logs
kubectl logs -n travelmemory <pod-name> --tail=100

# View logs with timestamp
kubectl logs -n travelmemory <pod-name> --timestamps
```

## 🔔 AlertManager Configuration

### Default Alert Configuration

Alerts are configured in `prometheus-rules-configmap.yaml`:
- High CPU usage (>80%)
- High memory usage (>85%)
- High disk usage (>85%)
- Pod restart loops
- Pods not running

### Viewing Alerts

**In Prometheus:**
http://localhost:30090/alerts

**In AlertManager:**
http://localhost:30093

### Configuring Notifications

Edit `alertmanager-configmap.yaml`:

#### Email Notifications

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'your-email@example.com'
        from: 'alerts@yourcompany.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@yourcompany.com'
        auth_password: 'your-password'
        send_resolved: true
```

#### Webhook Notifications

```yaml
receivers:
  - name: 'webhook-alerts'
    webhook_configs:
      - url: 'http://your-webhook-service.com/alerts'
        send_resolved: true
```

Then restart AlertManager:

```bash
kubectl rollout restart deployment alertmanager -n travelmemory
```

## 🛠️ Maintenance

### Updating Prometheus Configuration

```bash
# Edit the configmap
kubectl edit configmap prometheus-config -n travelmemory

# Or edit the file and apply
vim prometheus-configmap.yaml
kubectl apply -f prometheus-configmap.yaml

# Reload Prometheus (two options)
# Option 1: Restart deployment
kubectl rollout restart deployment prometheus -n travelmemory

# Option 2: Use API reload (if enabled)
curl -X POST http://localhost:30090/-/reload
```

### Updating Alert Rules

```bash
# Edit the alert rules
kubectl edit configmap prometheus-rules -n travelmemory

# Or edit the file and apply
vim prometheus-rules-configmap.yaml
kubectl apply -f prometheus-rules-configmap.yaml

# Reload Prometheus
kubectl rollout restart deployment prometheus -n travelmemory
```

### Updating Loki Configuration

```bash
# Edit the configmap
kubectl edit configmap loki-config -n travelmemory

# Or edit the file and apply
vim loki-configmap.yaml
kubectl apply -f loki-configmap.yaml

# Restart Loki
kubectl rollout restart deployment loki -n travelmemory
```

### Updating Promtail Configuration

```bash
# Edit the configmap
kubectl edit configmap promtail-config -n travelmemory

# Or edit the file and apply
vim promtail-configmap.yaml
kubectl apply -f promtail-configmap.yaml

# Restart Promtail daemonset
kubectl rollout restart daemonset promtail -n travelmemory
```

## 🔧 Troubleshooting

### Prometheus Not Scraping Targets

1. Check Prometheus configuration:
   ```bash
   kubectl exec -n travelmemory prometheus-xxx -- cat /etc/prometheus/prometheus.yml
   ```

2. Check Prometheus UI:
   http://localhost:30090/targets

3. Check pod logs:
   ```bash
   kubectl logs -n travelmemory prometheus-xxx
   ```

### Grafana Cannot Connect to Prometheus

1. Verify Prometheus is running:
   ```bash
   kubectl get pods -n travelmemory -l app=prometheus
   ```

2. Test Prometheus endpoint:
   ```bash
   kubectl exec -n travelmemory prometheus-xxx -- wget -qO- http://localhost:9090/api/v1/query?query=up
   ```

3. Check Grafana datasource configuration:
   Grafana → Configuration → Data Sources → Prometheus → Test

### Loki Not Receiving Logs

1. Check Promtail is running:
   ```bash
   kubectl get pods -n travelmemory -l app=promtail
   ```

2. Check Promtail logs:
   ```bash
   kubectl logs -n travelmemory promtail-xxx
   ```

3. Check Loki is running:
   ```bash
   kubectl get pods -n travelmemory -l app=loki
   ```

4. Check Loki logs:
   ```bash
   kubectl logs -n travelmemory loki-xxx
   ```

### High Disk Usage

Prometheus, Loki, and Grafana use persistent storage. Check usage:

```bash
# Check PVC sizes
kubectl get pvc -n travelmemory

# Current storage sizes:
# - prometheus-pvc: 20Gi
# - alertmanager-pvc: 5Gi
# - grafana-pvc: 10Gi
# - loki-pvc: 20Gi

# Check actual usage (requires being in pod)
kubectl exec -n travelmemory prometheus-xxx -- df -h
```

To reduce disk usage, edit retention settings:
- **Prometheus:** `prometheus-deployment.yaml` → `--storage.tsdb.retention.time=200h`
- **Loki:** `loki-configmap.yaml` → `retention_period: 720h`

## 📊 Resource Usage

Expected resource consumption:

| Component      | CPU Request | Memory Request | CPU Limit | Memory Limit |
|---------------|-------------|----------------|-----------|--------------|
| Prometheus    | 200m        | 512Mi          | 500m      | 1Gi          |
| AlertManager  | 100m        | 256Mi          | 200m      | 512Mi        |
| Grafana       | 100m        | 256Mi          | 200m      | 512Mi        |
| Node Exporter | 100m        | 180Mi          | 100m      | 180Mi        |
| Loki          | 200m        | 512Mi          | 500m      | 1Gi          |
| Promtail      | 100m        | 256Mi          | 200m      | 512Mi        |

## 🔒 Security Considerations

1. **Change Default Passwords:** Grafana admin password should be changed
2. **Network Policies:** Consider adding NetworkPolicies to restrict access
3. **RBAC:** Promtail has limited RBAC permissions
4. **Secrets Management:** Store sensitive configuration in Secrets
5. **Expose Services:** Consider using Ingress with TLS for production

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [AlertManager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Kubernetes Monitoring Best Practices](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-usage-monitoring/)

## ✅ Verification Checklist

- [ ] Prometheus is scraping all targets (check http://localhost:30090/targets)
- [ ] Grafana can query Prometheus (test in Explore tab)
- [ ] Grafana can query Loki (test in Explore tab)
- [ ] Alert rules are loaded (check http://localhost:30090/alerts)
- [ ] Promtail is collecting logs from all pods
- [ ] Loki is receiving logs (check in Grafana Explore)
- [ ] Node Exporter is exposing node metrics
- [ ] All PVCs are bound and mounted correctly
- [ ] All pods are in Running state
