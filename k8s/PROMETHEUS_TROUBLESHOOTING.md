## Prometheus targets DOWN while pods are Running – Why and How to fix

This doc explains why Prometheus may show targets as DOWN on the Targets page even when all Kubernetes pods are Running, and what we changed in this repo to fix it.

### The short answer

- **Pods Running ≠ Scraped by Prometheus.** Prometheus marks a target UP only if it can successfully scrape the metrics endpoint (connect + 200 OK + valid format) on the right address, port, and path.
- Common reasons for DOWN:
  - Missing `prometheus.io/*` annotations, so pods aren’t discovered by the `kubernetes-pods` job
  - Scrape jobs pointing to services that don’t actually expose `/metrics` (e.g., a React frontend)
  - Overly broad endpoints discovery scraping non-metrics services (noise of DOWN targets)
  - Missing RBAC for Kubernetes service discovery (can’t list/watch pods/endpoints)
  - Wrong port/path or network connectivity issues

---

## What we fixed in this repo

### 1) Add scrape annotations to the backend pods

File: `k8s/backend-deployment.yaml`

We added pod template annotations so the `kubernetes-pods` job discovers and scrapes the backend metrics exposed at `/metrics` on port 3000:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "3000"
    prometheus.io/path: "/metrics"
```

Why: Without these, the `kubernetes-pods` job ignores the pods.

### 2) Tighten Prometheus scrape config

File: `k8s/prometheus-configmap.yaml`

- Kept a dedicated job for Node Exporter and fixed matching to ensure endpoints resolve as expected.
- Replaced the broad `kubernetes-pods-endpoints` job with a selective `kubernetes-endpoints` job, scoping to `backend-service` only (prevents scraping non-metric services like MongoDB).
- Removed the `frontend` job because the React app doesn’t serve `/metrics` by default.

Why: Overly broad endpoint discovery causes many DOWN targets. Scraping the frontend also stays DOWN unless you instrument it.

### 3) Add RBAC for Prometheus service discovery

Files: `k8s/prometheus-serviceaccount.yaml`, `k8s/prometheus-deployment.yaml`

- Created `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` granting Prometheus `get/list/watch` on `pods`, `services`, `endpoints`, `nodes`.
- Set `serviceAccountName: prometheus` in the Prometheus Deployment.

Why: Without these, Prometheus may fail Kubernetes SD with permission errors and won’t discover targets.

---

## How to apply and verify

### Apply manifests

```bash
kubectl apply -f k8s/prometheus-serviceaccount.yaml
kubectl apply -f k8s/prometheus-configmap.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/prometheus-deployment.yaml
kubectl rollout restart deploy/prometheus -n travelmemory
```

### Check Prometheus targets

- Open: `http://localhost:30090/targets`
- Expect within ~30s:
  - `node-exporter` → UP
  - `kubernetes-pods` (backend pods via annotations) → UP
  - `kubernetes-endpoints` (backend-service) → UP

If a target is DOWN, click it to see the exact error:
- 404 Not Found → wrong path (e.g., endpoint doesn’t serve `/metrics`)
- connection refused/timeouts → wrong port/service, network/policy issues
- permission denied in logs → RBAC missing or ServiceAccount not set

### Quick in-cluster checks

From Prometheus pod:

```bash
kubectl exec -n travelmemory deploy/prometheus -- wget -qO- http://backend-service:3000/metrics
```

From any pod in the namespace:

```bash
kubectl run -n travelmemory tmp --rm -it --image=busybox -- restart=Never -- sh -c "wget -qO- http://node-exporter-service:9100/metrics | head"
```

Prometheus logs:

```bash
kubectl logs -n travelmemory deploy/prometheus
```

---

## How to avoid this next time

- Annotate only workloads that actually expose metrics; don’t annotate everything.
- Scope endpoints discovery narrowly to known metric services.
- Don’t create scrape jobs for components without `/metrics` (e.g., typical frontend) unless you add metrics.
- Ensure Prometheus has proper RBAC and is using the intended `ServiceAccount`.
- After config changes, reload Prometheus (`/-/reload`) or roll the Deployment.

---

## Reference of key files

- `k8s/backend-deployment.yaml` — pod annotations enabling scrape
- `k8s/prometheus-configmap.yaml` — scrape jobs and discovery rules
- `k8s/prometheus-serviceaccount.yaml` — RBAC for Kubernetes SD
- `k8s/node-exporter-daemonset.yaml`, `k8s/node-exporter-service.yaml` — node metrics
- `k8s/prometheus-deployment.yaml`, `k8s/prometheus-service.yaml` — Prometheus server and exposure


