# Storage in Kubernetes: PVC vs PV Explained

## 🎯 Quick Answer to Your Question

**You are correct!** We only create PVCs. Kubernetes automatically creates PVs for you.

---

## 📦 What's the Difference?

### PersistentVolume (PV)
- **What it is:** The actual storage (like a physical hard drive)
- **Who creates it:** Kubernetes automatically (in our setup)
- **Where:** Physical storage on your cluster nodes
- **You don't need to create this manually**

### PersistentVolumeClaim (PVC)
- **What it is:** Your request for storage (asking "I need 20Gi please")
- **Who creates it:** YOU create this (what we did in our YAML files)
- **Where:** YAML file that describes what you need
- **Example:** `prometheus-pvc.yaml`

---

## 🔄 How It Works on Docker Desktop

### Step 1: You Create a PVC

```yaml
# prometheus-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-pvc
spec:
  storageClassName: hostpath  # ← This is the key!
  resources:
    requests:
      storage: 20Gi
```

### Step 2: Kubernetes Creates the PV Automatically

When you run `kubectl apply -f prometheus-pvc.yaml`:

1. Kubernetes receives your PVC request
2. Sees `storageClassName: hostpath`
3. **Automatically creates a PV** that matches your request
4. Binds the PV to your PVC

### Step 3: Pod Uses the Storage

```yaml
# prometheus-deployment.yaml
volumeMounts:
  - name: prometheus-storage
    mountPath: /prometheus
volumes:
  - name: prometheus-storage
    persistentVolumeClaim:
      claimName: prometheus-pvc  # ← References your PVC
```

---

## 🏗️ StorageClass: The Missing Link

**StorageClass** is what makes automatic PV creation possible!

### What is StorageClass?

Think of it as a "recipe" that tells Kubernetes HOW to create storage:

```yaml
# Example StorageClass (already exists in your cluster)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: hostpath
provisioner: docker.io/hostpath  # ← Creates PVs on host filesystem
```

### Common Storage Classes

| StorageClass | Platform | How It Works |
|--------------|----------|--------------|
| `hostpath` | Docker Desktop | Creates storage on your local filesystem |
| `standard` | Cloud (AWS/GCP) | Creates cloud storage (EBS, PD, etc.) |
| `fast-ssd` | Production | Creates high-speed SSD storage |
| `""` (empty) | Default | Uses cluster's default storage class |

---

## 🔍 See for Yourself

### Check Your PVCs

```bash
kubectl get pvc -n travelmemory
```

**Output:**
```
NAME                 STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
prometheus-pvc       Bound    pvc-abc  20Gi       RWO            hostpath       5m
alertmanager-pvc     Bound    pvc-def  5Gi        RWO            hostpath       5m
grafana-pvc          Bound    pvc-ghi  10Gi       RWO            hostpath       5m
loki-pvc             Bound    pvc-jkl  20Gi       RWO            hostpath       5m
mongodb-pvc          Bound    pvc-mno  5Gi        RWO            hostpath       10m
```

### Check the PVs (automatically created!)

```bash
kubectl get pv
```

**Output:**
```
NAME      CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM                        STORAGECLASS   AGE
pvc-abc   20Gi       RWO            Delete           Bound    travelmemory/prometheus-pvc   hostpath       5m
pvc-def   5Gi        RWO            Delete           Bound    travelmemory/alertmanager-pvc hostpath       5m
pvc-ghi   10Gi       RWO            Delete           Bound    travelmemory/grafana-pvc      hostpath       5m
pvc-jkl   20Gi       RWO            Delete           Bound    travelmemory/loki-pvc         hostpath       5m
pvc-mno   5Gi        RWO            Delete           Bound    travelmemory/mongodb-pvc      hostpath       10m
```

**Notice:**
- PVs are created automatically
- Each PV is bound to a PVC
- They use the `hostpath` storage class

### Check Storage Classes

```bash
kubectl get storageclass
```

**Output (Docker Desktop):**
```
NAME                 PROVISIONER          RECLAIMPOLICY   VOLUMEBINDINGMODE   AGE
hostpath (default)   docker.io/hostpath   Delete          Immediate          5d
```

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (Developer)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │  Create PVC YAML file    │
         │  prometheus-pvc.yaml     │
         └───────────┬──────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │ kubectl apply -f ...     │
         └───────────┬──────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│              KUBERNETES (Automatic Process)                │
└────────────────────┬───────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
┌──────────────┐      ┌──────────────────┐
│ StorageClass │ ────▶│ Create PV        │
│ (hostpath)   │      │ (automatically!) │
└──────────────┘      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ Bind PV to PVC   │
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ Ready for Pods!  │
                      └──────────────────┘
```

---

## 🎓 Why This Design?

### Advantages of PVC + Auto-PV

✅ **Simpler:** You only create one file (PVC)  
✅ **Portable:** Same YAML works on Docker Desktop, AWS, GCP  
✅ **Automatic:** Kubernetes handles the details  
✅ **Flexible:** Works with any storage class  
✅ **Production-ready:** Same approach used in real clusters  

### When Would You Create PV Manually?

You usually **DON'T** need to, but you might if:

1. **Pre-existing storage:** You already have a volume
2. **Specific requirements:** Need exact placement or performance
3. **Legacy systems:** Migrating from older setup
4. **Testing:** Creating test volumes manually

---

## 🔧 What Happens on Different Platforms

### Docker Desktop (Local Development)
```yaml
storageClassName: hostpath
```
- Creates directories on your local filesystem
- Path: Usually under Docker's data directory
- Example: `~/.docker/volumes/`

### AWS (Production)
```yaml
storageClassName: gp2  # or gp3
```
- Creates AWS EBS volumes
- Automatically provisions cloud storage
- Attaches to EC2 instances

### GCP (Production)
```yaml
storageClassName: standard
```
- Creates GCE Persistent Disks
- Integrates with GKE cluster
- Automatic backups

### Azure (Production)
```yaml
storageClassName: managed-premium
```
- Creates Azure Managed Disks
- Integrated with AKS
- Automatic replication

---

## 📝 Our PVC Files

In your project, we have these PVCs:

| PVC Name | Storage | Used By | Purpose |
|----------|---------|---------|---------|
| `mongodb-pvc` | 5Gi | MongoDB | Database data |
| `prometheus-pvc` | 20Gi | Prometheus | Metrics data |
| `alertmanager-pvc` | 5Gi | AlertManager | Alert state |
| `grafana-pvc` | 10Gi | Grafana | Dashboards & users |
| `loki-pvc` | 20Gi | Loki | Log data |

**All use `storageClassName: hostpath` for Docker Desktop**

---

## 💡 Key Takeaways

1. ✅ **You only create PVCs** - Kubernetes creates PVs automatically
2. ✅ **StorageClass** is what makes this automatic
3. ✅ **hostpath** is for Docker Desktop local development
4. ✅ **Same PVC YAML** works on different platforms (just change storageClassName)
5. ✅ **No manual PV creation needed** in our setup

---

## 🧪 Try It Yourself

1. Deploy a PVC:
   ```bash
   kubectl apply -f prometheus-pvc.yaml
   ```

2. Watch the PV get created:
   ```bash
   kubectl get pv -w
   ```

3. Check PVC status:
   ```bash
   kubectl describe pvc prometheus-pvc -n travelmemory
   ```

You'll see Kubernetes automatically created and bound a PV for you!

---

## 📚 Summary

**Your understanding is correct!** 

- We create PVCs (requests for storage)
- Kubernetes creates PVs (actual storage)
- StorageClass makes it automatic
- No manual PV creation needed

This is the standard, production-ready approach! 🎉

