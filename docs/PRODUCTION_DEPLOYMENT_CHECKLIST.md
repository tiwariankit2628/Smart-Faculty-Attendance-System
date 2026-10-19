# Production Deployment Checklist & Security Runbook

This document details the configuration parameters, infrastructure prerequisites, architectural considerations, and verification procedures required to deploy the **Smart Faculty Attendance System** to a production environment.

---

## 1. Required Production Environment Variables

All variables below must be supplied via a secure environment manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, or Kubernetes Secrets). Do **NOT** commit plaintext secrets to source control.

| Variable | Requirement & Specification | Example / Format |
|---|---|---|
| `NODE_ENV` | Must be set to `production` (enforces strict schema validation, disables debug stacks, disables in-memory defaults). | `production` |
| `PORT` | Backend HTTP service port. | `5000` |
| `MONGODB_URI` | Authenticated MongoDB replica set or MongoDB Atlas cluster connection string with TLS enabled. | `mongodb+srv://<user>:<password>@cluster.domain.mongodb.net/geo_faculty_attendance?retryWrites=true&w=majority` |
| `REDIS_HOST` | Hostname or endpoint of the production Redis cluster/managed instance. | `attendance-cache.internal.lpu.in` |
| `REDIS_PORT` | Port of the Redis service (default `6379` or `6380` for TLS). | `6379` |
| `REDIS_PASSWORD` | Strong password / token for Redis `AUTH`. | `<production_redis_auth_token>` |
| `REDIS_ALLOW_FALLBACK` | Set to `false` in clustered production to prevent memory drift across stateless replicas. | `false` |
| `JWT_ACCESS_SECRET` | Cryptographically random secret ($\ge 32$ characters) used to sign and verify faculty & admin access tokens. | `<32+_char_random_hex_or_base64>` |
| `JWT_ACCESS_EXPIRY` | Short-lived token duration. Recommended: `15m` to limit exposure window. | `15m` |
| `COOKIE_SECRET` | Cryptographically random secret ($\ge 16$ characters) for signing session cookies. | `<16+_char_random_secret>` |
| `CORS_ORIGIN` | Strict origin URL of the deployed frontend portal. Wildcard (`*`) and `localhost` are strictly rejected in production mode. | `https://attendance.lpu.in` |
| `FACE_SERVICE_URL` | Private network address of the Python OpenCV/YuNet/SFace biometric microservice. | `http://face-service.internal:8000` |
| `FACE_SERVICE_API_KEY` | Shared secret header (`X-Service-API-Key`) between Node.js API and Python face microservice. | `<strong_internal_service_key>` |
| `MOCK_FACE_SERVICE` | Must be `false` in production. Setting to `true` in production is rejected at startup. | `false` |
| `CAMPUS_ALLOWED_IPS` | Comma-separated list of public exit IPs of the official university gateway routers. | `203.0.113.10,203.0.113.11` |
| `CAMPUS_ALLOWED_CIDRS` | Authorized internal university subnets for intranet attendance. | `10.20.0.0/16,172.16.0.0/12` |
| `ENABLE_CAMPUS_NETWORK_CHECK` | Enforces network validation anchor. Must be `true` for physical presence enforcement. | `true` |
| `TRUST_PROXY` | Configures Express reverse proxy trust. Use `true` or exact hop count if behind Nginx/ALB/Cloudflare; use `false` if exposed directly. | `1` (or `true`) |
| `DEFAULT_GEOFENCE_LAT` | Latitude coordinate of the campus anchor center (LPU Main Campus default: `31.2536`). | `31.2536` |
| `DEFAULT_GEOFENCE_LNG` | Longitude coordinate of the campus anchor center (LPU Main Campus default: `75.7037`). | `75.7037` |
| `DEFAULT_GEOFENCE_RADIUS_METERS`| Enforced campus radial fence boundary in meters (default: `500`). | `500` |
| `MAX_ALLOWED_ACCURACY_METERS` | Maximum permissible GPS device horizontal accuracy error in meters (default: `35`). | `35` |
| `ATTENDANCE_EVIDENCE_RETENTION_DAYS`| Privacy retention duration for biometric verification snapshot evidence (default: `90`). | `90` |
| `EVIDENCE_STORAGE_PATH` | Path to persistent storage volume (or mount point of shared network storage). | `/var/lib/attendance/evidence` |

---

## 2. Infrastructure & Architectural Requirements

### A. High Availability & Multi-Instance Clustered Deployment
1. **Redis Shared State**:
   - In single-server development, an in-memory fallback handles offline cache requests.
   - In multi-instance or auto-scaling production, `REDIS_ALLOW_FALLBACK` must be set to `false`. All replicas must connect to a shared Redis cluster so challenge tokens, rate limits, and verification nonces are universally synchronized.
2. **Biometric Evidence Volume Storage**:
   - Verification snapshots captured during liveness challenges are saved to disk with opaque cryptographic hashes.
   - For multi-instance deployments behind a load balancer, `EVIDENCE_STORAGE_PATH` must point to a shared Network File System (AWS EFS, Azure Files, Google Cloud Filestore, or persistent NFS mount) so admin evidence requests can be fulfilled by any backend instance.
3. **Stateless API Replicas**:
   - All backend pods/containers are fully stateless. Session identity is derived entirely from verified JWT payloads.

### B. Network, HTTPS & Reverse Proxy Architecture
1. **TLS Termination & HSTS**:
   - Terminate TLS 1.3 at the reverse proxy / ingress controller (Nginx, Traefik, or AWS ALB).
   - Enforce HTTP Strict Transport Security (`HSTS`) headers: `max-age=31536000; includeSubDomains; preload`.
2. **Proxy Spoofing Deterrence**:
   - If behind a reverse proxy (e.g., Nginx, AWS ALB), set `TRUST_PROXY=1` (or `true`).
   - The ingress reverse proxy must strip or overwrite any incoming client-supplied `X-Forwarded-For` header before appending the true client socket address to prevent IP spoofing attacks.
3. **Internal Microservice Isolation**:
   - The Python `face-service` (port 8000) must **never** be exposed to public ingress. It must reside inside a private VPC subnet accessible only to the Node.js backend cluster.

---

## 3. Database Security & Backup Strategy

1. **MongoDB Atlas / Replica Set**:
   - Enforce SCRAM-SHA-256 or X.509 certificate authentication.
   - Enable automated point-in-time recovery (PITR) with continuous oplog archiving.
   - Daily automated backups retained for 30 days minimum.
2. **Audit Log Immutability**:
   - Audit trail records in MongoDB collection `audit_logs` are strictly append-only.
   - Do not grant `DELETE` or `UPDATE` privileges on `audit_logs` to routine application database users.
3. **MongoDB Production Indexes**:
   - Ensure the following compound indexes are present:
     - `attendances`: `{ facultyId: 1, date: 1 }` (unique constraint)
     - `attendances`: `{ timestamp: -1 }`
     - `attendances`: `{ status: 1, date: 1 }`
     - `audit_logs`: `{ timestamp: -1 }`
     - `audit_logs`: `{ action: 1, timestamp: -1 }`
     - `users`: `{ employeeId: 1 }` (unique constraint)
     - `users`: `{ email: 1 }` (unique constraint)

---

## 4. Maintenance, Retention & Cron Jobs

1. **Evidence Cleanup Worker**:
   - Run daily cron or Kubernetes CronJob calling `POST /api/v1/admin/evidence/cleanup` (authenticated with system admin credentials) to purge expired snapshots exceeding `ATTENDANCE_EVIDENCE_RETENTION_DAYS`.
   - Records metadata and purged file references in the immutable audit log (`EVIDENCE_PURGED`).
2. **Certificate Renewal**:
   - Automate Let's Encrypt / ACME renewals via `certbot` or `cert-manager` with alert notifications on expiration within 15 days.

---

## 5. Security Monitoring & Incident Response

1. **Log Ingestion & Alerting**:
   - Stream structured JSON application logs (Pino output) into an enterprise SIEM (Datadog, AWS CloudWatch, Elastic/Logstash, or Grafana Loki).
   - Configure immediate alerts for:
     - Spikes in `RATE_LIMIT_EXCEEDED` (code 429)
     - Sustained `LOCATION_NETWORK_NOT_TRUSTED` rejections (code 403)
     - Spikes in `LIVENESS_FAILED` or `FACE_MISMATCH`
     - Repeated `ADMIN_RESET_FACULTY_FACE` events
2. **Zero Sensitive Data Leakage**:
   - Production log streams are validated to never output passwords, JWT tokens, Redis tokens, raw face embedding vectors, or base64 frame buffers.
