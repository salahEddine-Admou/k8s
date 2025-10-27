# Kubernetes Deployment - Travel Memory App

Complete deployment guide for running your application on Kubernetes with Docker Desktop.

## 🌐 Application Ports

- **Frontend:** http://localhost:30001
- **Backend API:** http://localhost:30003
- **MongoDB:** Internal (27017)

---

## 📁 Files Overview & Purpose

### Core Configuration Files

| File | Purpose | Why We Need It |
|------|---------|----------------|
| **namespace.yaml** | Creates isolated environment | Keeps resources organized and separated from other apps |
| **secrets.yaml** | Stores MongoDB credentials | Securely stores passwords (admin, password123, database name) |
| **configmap.yaml** | Stores app configuration | Centralizes environment variables, connection strings, URLs |

### Storage & Database

| File | Purpose | Why We Need It |
|------|---------|----------------|
| **mongodb-pvc.yaml** | Requests persistent storage | Keeps MongoDB data even when pod restarts or is deleted |
| **mongodb-deployment.yaml** | Creates MongoDB pods | Runs MongoDB with 1 replica, mounts PVC for data persistence |
| **mongodb-service.yaml** | Exposes MongoDB internally | Provides stable DNS name for backend to connect to |

#### **Why PVC vs PV (PersistentVolume)?**

**PV vs PVC:**
- **PV (PersistentVolume)** = Actual storage device (must be created by admin)
- **PVC (PersistentVolumeClaim)** = Your request for storage (you create this)

**Why we use PVC instead of PV:**
1. **Simplicity:** PVC automatically finds/create a PV
2. **Portability:** Same YAML works on Docker Desktop, AWS, GCP
3. **Automation:** Kubernetes handles PV creation via StorageClass
4. **Self-service:** No need for cluster admin to create PV manually

**When to use PV directly:**
- You have specific storage requirements
- Pre-existing storage volumes
- Administrative control over storage
- Advanced storage setups

**In our setup:** We use PVC, which requests storage from the cluster. The cluster then automatically creates a matching PV using the StorageClass.

### Backend API

| File | Purpose | Why We Need It |
|------|---------|----------------|
| **backend-deployment.yaml** | Creates backend API pods | Runs Node.js backend with 2 replicas for HA, health checks |
| **backend-service.yaml** | Exposes backend externally | Allows browser to access API on port 30003 |

### Frontend

| File | Purpose | Why We Need It |
|------|---------|----------------|
| **frontend-deployment.yaml** | Creates frontend pods | Runs React app with 2 replicas, requires 1Gi memory |
| **frontend-service.yaml** | Exposes frontend externally | Allows browser to access app on port 30001 |

### Order of Deployment

```
1. namespace.yaml       → Create isolated environment
2. secrets.yaml          → Database credentials (needed by MongoDB & Backend)
3. configmap.yaml        → Configuration (needed by all components)
4. mongodb-pvc.yaml      → Storage request (needed by MongoDB pod)
5. mongodb-deployment    → Start MongoDB (must be ready before backend)
6. mongodb-service        → Internal DNS for backend
7. backend-deployment    → Start Backend API (connects to MongoDB)
8. backend-service       → Expose backend externally
9. frontend-deployment   → Start React app (calls backend API)
10. frontend-service     → Expose frontend externally

```

**Why this order?**
- Namespace must exist first (contains all resources)
- Secrets/ConfigMap provide credentials and config to pods
- PVC must bind before MongoDB pod can start
- MongoDB must be ready before backend can connect
- Backend must be running before frontend can call it
- Services expose pods to network (internal or external)

---

## 📋 Prerequisites

1. **Docker Desktop** with Kubernetes enabled
2. **kubectl** installed and configured
3. **Docker images** built:
   - `travelmemory-backend:latest`
   - `travelmemory-frontend:latest`
4. **Images available** in Docker Desktop:
   ```bash
   docker images 
   ```

---

## 🚀 Deployment Steps

### Step 1: Ensure Backend CORS Configuration

Before deploying, ensure `backend/index.js` has CORS configured for port 30001:

```javascript
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:30001', 'http://localhost:3000'],
  credentials: true
}))
```

### Step 2: Build Docker Images (If Not Already Built)

```bash
# Build backend
docker build -t travelmemory-backend:latest -f backend/Dockerfile backend/

# Build frontend (with correct API URL hardcoded)
# First, edit frontend/src/url.js to have:
export const baseUrl = "http://localhost:30003"

# Then build
docker build -t travelmemory-frontend:latest -f frontend/Dockerfile frontend/
```

**Important:** The frontend uses a hardcoded API URL in `url.js` because React environment variables are evaluated at build time.

### Step 3: Deploy to Kubernetes

```bash
# Navigate to k8s directory
cd k8s

# Deploy all resources
kubectl apply -f .

# Or deploy individually
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f mongodb-pvc.yaml
kubectl apply -f mongodb-deployment.yaml
kubectl apply -f mongodb-service.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
```

### Step 4: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n travelmemory

# Expected output:
# NAME                                  READY   STATUS    RESTARTS   AGE
# backend-deployment-xxx                 1/1     Running   0          Xs
# frontend-deployment-xxx                1/1     Running   0          Xs
# mongodb-deployment-xxx                 1/1     Running   0          Xs

# Check services
kubectl get svc -n travelmemory
```

### Step 5: Access Application

- **Frontend:** http://localhost:30001
- **Backend:** http://localhost:30003

---

## 🔧 Configuration Files

### Critical Configuration Points

1. **PVC Storage Class** (`mongodb-pvc.yaml`)
   - Uses `hostpath` for Docker Desktop
   - Storage: 5Gi
   
   **PVC vs PV Explained:**
   
   **PersistentVolume (PV)** - The actual storage:
   ```yaml
   # Created manually by admin
   kind: PersistentVolume
   spec:
     capacity:
       storage: 5Gi
     hostPath:
       path: /mnt/data  # Physical disk location
   ```
   - Admin must create this
   - Requires knowledge of storage details
   - Not portable across clusters
   
   **PersistentVolumeClaim (PVC)** - Your request:
   ```yaml
   # Created by you
   kind: PersistentVolumeClaim
   spec:
     storageClassName: "hostpath"  # Auto-creates PV
     resources:
       requests:
         storage: 5Gi
   ```
   - You create this
   - Kubernetes auto-creates matching PV
   - Portable across environments
   - **This is what we use in our setup**
   
   **Why PVC is better:**
   - ✅ Automatic PV creation via StorageClass
   - ✅ Works on any Kubernetes cluster
   - ✅ No need for cluster admin intervention
   - ✅ Dynamic provisioning
   
   **Other Storage Class Options:**
   
   | Storage Class | Usage | When to Use |
   |--------------|-------|-------------|
   | `""` (empty) | Default class | General purpose, cloud providers |
   | `hostpath` | Docker Desktop/Local | Local development, single node |
   | `standard` | Cloud providers | Production on AWS/GCP/Azure |
   | `fast-ssd` | High performance | Database workloads requiring speed |
   | `nfs-client` | Network storage | Multiple nodes, shared storage |
   
   **How to change:**
   ```yaml
   # In mongodb-pvc.yaml, line 38:
   storageClassName: "hostpath"  # For Docker Desktop
   storageClassName: "standard"   # For cloud (AWS EBS, GCP PD)
   storageClassName: ""           # Use cluster default
   ```
   
   **Check available storage classes:**
   ```bash
   kubectl get storageclass
   ```

2. **Frontend Resources** (`frontend-deployment.yaml`)
   - Memory: 1Gi (required for React build)
   - CPU: 500m
   
   **Resource Limit Options:**
   
   | Resource | Current | Options | Notes |
   |----------|---------|---------|-------|
   | **Requests** (guaranteed) | Memory: 512Mi<br>CPU: 100m | Increase for production | Pod won't start if unavailable |
   | **Limits** (maximum) | Memory: 1Gi<br>CPU: 500m | Remove for unlimited* | Container killed if exceeded |
   
   *Not recommended - can starve other pods
   
   **Common resource units:**
   - Memory: `256Mi` (megabytes), `1Gi` (gigabyte), `500M` (megabytes)
   - CPU: `100m` (0.1 core), `1` (1 core), `2` (2 cores)
   
   **How to adjust:**
   ```yaml
   resources:
     requests:
       memory: "512Mi"  # Minimum guaranteed
       cpu: "100m"
     limits:
       memory: "1Gi"    # Maximum allowed
       cpu: "500m"
   ```

3. **Backend Resources** (`backend-deployment.yaml`)
   - Memory: 512Mi
   - CPU: 500m
   - Health checks enabled
   
   **Replica Options:**
   - Current: 2 replicas (frontend & backend)
   - Scale up for load: `kubectl scale deployment backend-deployment --replicas=5 -n travelmemory`
   - Scale down to save resources: `--replicas=1`
   - Auto-scale: Requires metrics-server and HPA configured

4. **Service Types**
   - Frontend: NodePort (30001)
   - Backend: NodePort (30003)
   - MongoDB: ClusterIP (internal)
   
   **Service Type Options:**
   
   | Type | Exposes | When to Use | Example |
   |------|---------|-------------|---------|
   | **ClusterIP** | Internal only | Database, internal APIs | MongoDB, Backend API (secure) |
   | **NodePort** | External via node IP | Development, testing | Access from browser on localhost |
   | **LoadBalancer** | External cloud IP | Production, public-facing | Frontend for users |
   | **Ingress** | HTTP/HTTPS routing | Production, domain names | `app.com` with SSL |
   
   **How to change:**
   ```yaml
   # In xxx-service.yaml
   spec:
     type: NodePort       # Access via localhost:30001
     type: LoadBalancer   # Cloud provider IP
     type: ClusterIP      # Internal only
   ```
   
   **For production**, consider:
   - Frontend: LoadBalancer or Ingress with domain
   - Backend: ClusterIP (use Ingress for API routing)
   - MongoDB: ClusterIP (never expose externally)

5. **Health Check Options** (in deployments)
   
   | Probe Type | Purpose | Current | Options |
   |-----------|---------|---------|---------|
   | **Liveness** | Is it alive? | `GET /health` every 10s | Restart pod if dead |
   | **Readiness** | Can it serve? | `GET /health` every 5s | Remove from load balancer |
   | **Startup** | Initial startup | None | Wait before checking liveness |
   
   **How to adjust:**
   ```yaml
   livenessProbe:
     httpGet:
       path: /health
       port: 3000
     initialDelaySeconds: 30  # Wait before first check
     periodSeconds: 10        # Check every 10s
     failureThreshold: 3      # Restart after 3 failures
   ```

6. **API URL Hardcoding**
   - Frontend `url.js` must have: `export const baseUrl = "http://localhost:30003"`
   - This is hardcoded because React env vars are evaluated at build time
   
   **Alternative Options:**
   
   | Method | Pros | Cons | Use Case |
   |--------|------|------|----------|
   | Hardcode in `url.js` | Simple, works always | Must rebuild to change | **Current (Best for K8s)** |
   | Build-time env var | Flexible for different envs | Only works if set at build | CI/CD pipelines |
   | Runtime config | Change without rebuild | Complex setup | Large apps with many envs |
   
   **For different environments:**
   - Development: `http://localhost:30003`
   - Production: Your production API URL
   - Staging: Staging API URL

---

## 🐛 Troubleshooting

### Issue: PVC Stuck in Pending

```bash
kubectl get pvc -n travelmemory

# Fix: Ensure storageClassName is "hostpath" in mongodb-pvc.yaml
kubectl delete pvc mongodb-pvc -n travelmemory
kubectl apply -f mongodb-pvc.yaml
```

### Issue: Backend/Frontend CrashLoopBackOff

```bash
# Check logs
kubectl logs -n travelmemory <pod-name> --tail=50

# Check if MongoDB is running first
kubectl get pods -n travelmemory -l component=database

# Restart pods
kubectl delete pods -n travelmemory -l component=backend
kubectl delete pods -n travelmemory -l component=frontend
```

### Issue: Frontend Out of Memory

**Error:** `The build failed because the process exited too early. This probably means the system ran out of memory`

**Fix:** In `frontend-deployment.yaml`, increase memory:

```yaml
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"  # Was 256Mi
```

### Issue: Network Error / CORS Error

**Symptom:** Browser shows network errors when trying to fetch data

**Fix:** 
1. Check backend CORS allows `http://localhost:30001`
2. Verify backend service is accessible:
   ```bash
   curl http://localhost:30003/health
   ```
3. Rebuild backend and restart pods:
   ```bash
   docker build -t travelmemory-backend:latest -f backend/Dockerfile backend/
   kubectl delete pods -n travelmemory -l component=backend
   ```

### Issue: Wrong API URL

**Symptom:** Frontend can't connect to backend

**Fix:**
1. Edit `frontend/src/url.js`:
   ```javascript
   export const baseUrl = "http://localhost:30003"
   ```
2. Rebuild frontend image:
   ```bash
   docker build --no-cache -t travelmemory-frontend:latest -f frontend/Dockerfile frontend/
   ```
3. Restart frontend pods:
   ```bash
   kubectl delete pods -n travelmemory -l component=frontend
   ```

---

## 📊 Useful Commands

### View Logs

```bash
# All pods
kubectl logs -n travelmemory -l app=travelmemory -f

# Specific pod
kubectl logs -n travelmemory <pod-name> -f

# Backend logs
kubectl logs -n travelmemory -l component=backend -f

# Frontend logs
kubectl logs -n travelmemory -l component=frontend -f

# MongoDB logs
kubectl logs -n travelmemory -l component=database -f
```

### Debug Pods

```bash
# Describe pod (see events and status)
kubectl describe pod -n travelmemory <pod-name>

# Execute into pod
kubectl exec -it -n travelmemory <pod-name> -- /bin/sh

# Check environment variables
kubectl exec -n travelmemory <pod-name> -- env

# Check specific file
kubectl exec -n travelmemory <pod-name> -- cat src/url.js
```

### Scale Applications

```bash
# Scale backend
kubectl scale deployment backend-deployment --replicas=3 -n travelmemory

# Scale frontend
kubectl scale deployment frontend-deployment --replicas=3 -n travelmemory
```

### Check Services and Endpoints

```bash
# List all services
kubectl get svc -n travelmemory

# Check service endpoints
kubectl get endpoints -n travelmemory

# Test backend
curl http://localhost:30003/health
curl http://localhost:30003/trip

# Test frontend
curl http://localhost:30001
```

---

## 🗑️ Cleanup / Delete Everything

### Delete Everything (Complete Cleanup)

```bash
# Option 1: Delete entire namespace (cleans up everything)
kubectl delete namespace travelmemory

# Option 2: Delete all resources manually
kubectl delete all --all -n travelmemory
kubectl delete pvc --all -n travelmemory
kubectl delete secrets --all -n travelmemory
kubectl delete configmap --all -n travelmemory

# Option 3: Delete namespace and recreate
kubectl delete namespace travelmemory
kubectl create namespace travelmemory
```

### Delete Specific Components

```bash
# Delete only frontend
kubectl delete deployment frontend-deployment -n travelmemory
kubectl delete svc frontend-service -n travelmemory

# Delete only backend
kubectl delete deployment backend-deployment -n travelmemory
kubectl delete svc backend-service -n travelmemory

# Delete only MongoDB
kubectl delete deployment mongodb-deployment -n travelmemory
kubectl delete svc mongodb-service -n travelmemory
kubectl delete pvc mongodb-pvc -n travelmemory
```

### Remove Docker Images (Optional)

```bash
# Remove frontend image
docker rmi travelmemory-frontend:latest

# Remove backend image
docker rmi travelmemory-backend:latest

# Remove all travelmemory images
docker images | grep travelmemory | awk '{print $3}' | xargs docker rmi
```

---

## 🔄 Rebuild and Redeploy

### After Code Changes

1. **Backend Changes:**
   ```bash
   docker build -t travelmemory-backend:latest -f backend/Dockerfile backend/
   kubectl rollout restart deployment backend-deployment -n travelmemory
   ```

2. **Frontend Changes:**
   ```bash
   # Edit files, then rebuild
   docker build -t travelmemory-frontend:latest -f frontend/Dockerfile frontend/
   kubectl rollout restart deployment frontend-deployment -n travelmemory
   ```

3. **Force Delete and Recreate:**
   ```bash
   # Backend
   kubectl delete deployment backend-deployment -n travelmemory
   kubectl apply -f backend-deployment.yaml

   # Frontend
   kubectl delete deployment frontend-deployment -n travelmemory
   kubectl apply -f frontend-deployment.yaml
   ```

---

## ✅ Success Indicators

All pods should show `1/1 Ready` status:

```bash
kubectl get pods -n travelmemory
# Expected:
# NAME                              READY   STATUS    RESTARTS   AGE
# backend-deployment-xxx             1/1     Running   0          Xs
# frontend-deployment-xxx            1/1     Running   0          Xs
# mongodb-deployment-xxx             1/1     Running   0          Xs
```

Services should be accessible:

```bash
# Health check
curl http://localhost:30003/health
# Expected: {"status":"OK","timestamp":"..."}

# Get trips
curl http://localhost:30003/trip
```

---

## 📝 Important Notes

### Docker Environment Variables

- **React apps:** Environment variables are **baked into the bundle at build time**
- **Solution:** Hardcode the API URL in `url.js` instead of using `process.env`
- Example: `export const baseUrl = "http://localhost:30003"`

### Entry Points

- **Frontend:** `npm start` (development server on port 3000, exposed via NodePort 30001)
- **Backend:** `node index.js` (production on port 3000, exposed via NodePort 30003)
- **MongoDB:** Standard MongoDB on port 27017 (internal only)

### Resource Limits

- **Frontend:** 1Gi memory required (React build needs space)
- **Backend:** 512Mi memory sufficient
- **MongoDB:** Uses persistent storage via PVC

### Networking

- Kubernetes services use internal DNS
- External access via NodePort on localhost
- CORS must allow browser origin: `http://localhost:30001`

---

## 🎓 Learning Summary

You've successfully learned:
- ✅ Kubernetes basics (Pods, Deployments, Services)
- ✅ Persistent Volumes and PVCs
- ✅ ConfigMaps and Secrets
- ✅ Health checks and resource limits
- ✅ Network policies (NodePort vs ClusterIP)
- ✅ Troubleshooting common issues
- ✅ CORS configuration
- ✅ Docker image building
- ✅ React environment variables
- ✅ Complete app deployment

**Application is live at http://localhost:30001**
