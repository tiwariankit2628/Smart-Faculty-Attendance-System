# Geo-Verified Faculty Attendance System — Backend

Production-ready, highly secure backend engine for the **Geo-Verified Faculty Attendance System**, built with Node.js, Express, TypeScript, MongoDB, and Redis.

---

## 🏛️ Architecture Overview

The backend uses a **modular, service-oriented layered architecture**:

```
backend/
├── src/
│   ├── config/             # Environment, DB, and Redis configurations
│   │   ├── db.ts           # Mongoose MongoDB connection & disconnect handlers
│   │   ├── env.ts          # Zod-validated environment schema
│   │   └── redis.ts        # Redis client with resilient in-memory fallback
│   ├── controllers/        # Express HTTP request & response handlers
│   │   ├── admin.controller.ts
│   │   ├── attendance.controller.ts
│   │   ├── auth.controller.ts
│   │   └── faculty.controller.ts
│   ├── middleware/         # Security, validation, and auth middlewares
│   │   ├── auth.middleware.ts        # JWT & HTTP-only cookie verification
│   │   ├── errorHandler.middleware.ts # Standardized API error responses
│   │   ├── rateLimiter.middleware.ts  # Express rate limiting
│   │   ├── requestId.middleware.ts    # Correlation ID injection
│   │   ├── role.middleware.ts        # Role-based access control (FACULTY / ADMIN)
│   │   └── validate.middleware.ts    # Zod payload validation
│   ├── models/             # Mongoose schemas with compound indexes
│   │   ├── Attendance.ts   # Unique index on { facultyId, date }
│   │   ├── AttendanceZone.ts
│   │   ├── AuditLog.ts
│   │   └── User.ts
│   ├── repositories/       # Data access abstraction layer
│   │   ├── attendance.repository.ts
│   │   ├── attendanceZone.repository.ts
│   │   ├── auditLog.repository.ts
│   │   └── user.repository.ts
│   ├── routes/             # RESTful API route definitions
│   │   ├── admin.routes.ts
│   │   ├── attendance.routes.ts
│   │   ├── auth.routes.ts
│   │   ├── faculty.routes.ts
│   │   └── index.ts
│   ├── services/           # Core domain business logic
│   │   ├── admin.service.ts
│   │   ├── attendance.service.ts     # Geofence & attendance verification pipeline
│   │   ├── audit.service.ts          # Centralized audit logging
│   │   ├── auth.service.ts           # Authentication & token issuing
│   │   ├── faceVerification.service.ts # HTTP bridge to Python AI service
│   │   └── faculty.service.ts
│   ├── types/              # TypeScript interface definitions
│   ├── utils/              # Cryptographic, Haversine geo, and logger utilities
│   │   ├── apiError.ts     # Typed AppError class
│   │   ├── apiResponse.ts  # Standard { success, data } envelope
│   │   ├── crypto.ts       # Bcrypt password hashing & JWT signing
│   │   ├── geo.ts          # Haversine distance & coordinate bounds
│   │   ├── logger.ts       # Pino structured logger with credential redaction
│   │   └── seed.ts         # Database bootstrapper
│   ├── app.ts              # Express application assembly
│   └── server.ts           # HTTP server startup & graceful shutdown
└── tests/
    ├── integration/        # Supertest API route integration tests
    └── unit/               # Geo, Crypto, and Service domain unit tests
```

---

## 🔒 Security & Data Integrity Highlights

1. **Server-Side Geofencing**: Client-provided distances are **never** trusted. The distance between incoming coordinates and the active `AttendanceZone` is calculated strictly on the backend using the spherical **Haversine formula**.
2. **Database Level Uniqueness**: A MongoDB compound unique index `{ facultyId: 1, date: 1 }` prevents duplicate attendances at the database engine level, immune to race conditions.
3. **Distributed Idempotency & Locking**: Redis locks (`attendance:lock:<facultyId>:<date>`) prevent parallel duplicate submissions, and `idempotencyKey` caching guarantees that replay attacks return deterministic cached attendance records.
4. **Short-Lived Verification Tokens**: `POST /verify-location` and `POST /verify-face` generate cryptographically random, 5-minute single-use Redis tokens (`loc_*`, `face_*`) to enforce step-by-step verification before marking attendance.
5. **No Biometrics in Node.js**: Facial recognition is delegated to the dedicated Python/FastAPI microservice via secure internal HTTP communication. If the Python service is offline, a proper `503 Service Unavailable` response is returned. Fake verifications are strictly avoided.
6. **Authentication Security**:
   - Passwords hashed with Bcrypt (cost factor 12).
   - Short-lived JSON Web Tokens (15m expiry).
   - Secure HTTP-only cookies (`SameSite=Lax`, `HttpOnly=true`, `Secure` in production).
   - Secrets, authorization headers, passwords, and face image base64 strings are **redacted** in logs.
   - Centralized error formatting ensures no stack traces leak in production.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0+ (Local or MongoDB Atlas)
- **Redis**: v6.0+ (Optional; built-in in-memory fallback handles offline development)
- **Python Face Service**: FastAPI service running at `http://localhost:8000`

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

| Key | Description | Default |
|-----|-------------|---------|
| `PORT` | Backend listening port | `5000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/geo_faculty_attendance` |
| `REDIS_HOST` | Redis cache hostname | `localhost` |
| `REDIS_PORT` | Redis cache port | `6379` |
| `JWT_ACCESS_SECRET` | Secret key for JWT signing (min 16 chars) | - |
| `JWT_ACCESS_EXPIRY` | Token validity duration | `15m` |
| `COOKIE_SECRET` | Secret for cookie parser signing | - |
| `CORS_ORIGIN` | Allowed client origin | `http://localhost:3000` |
| `FACE_SERVICE_URL` | Python FastAPI biometric microservice endpoint | `http://localhost:8000` |
| `FACE_SERVICE_API_KEY` | Internal API key for microservice authentication | - |
| `DEFAULT_GEOFENCE_LAT` | LPU Campus latitude | `31.2536` |
| `DEFAULT_GEOFENCE_LNG` | LPU Campus longitude | `75.7037` |
| `DEFAULT_GEOFENCE_RADIUS_METERS`| Geofence radius | `500` |
| `MAX_ALLOWED_ACCURACY_METERS` | Max allowed GPS accuracy radius | `35` |

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The application automatically seeds Lovely Professional University (LPU) default geofence and credentials:
- **Admin**: `admin@lpu.in` / `AdminPassword@123`
- **Faculty**: `faculty@lpu.in` / `FacultyPassword@123`

### 4. Build for Production

```bash
npm run build
npm start
```

### 5. Running Tests

```bash
# Run unit & integration tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## 📡 API Endpoint Summary

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/login` — Authenticate user, receive JWT & HTTP-only cookie
- `POST /api/v1/auth/logout` — Invalidate session and clear auth cookies
- `GET  /api/v1/auth/me` — Retrieve current authenticated user profile

### Faculty (`/api/v1/faculty`)
- `GET  /api/v1/faculty/profile` — Faculty profile information
- `GET  /api/v1/faculty/attendance` — Personal attendance history & statistics
- `POST /api/v1/faculty/face-registration` — Register biometric facial template

### Attendance (`/api/v1/attendance`)
- `POST /api/v1/attendance/verify-location` — Validate GPS coordinates against active geofence
- `POST /api/v1/attendance/verify-face` — Validate biometric facial capture
- `POST /api/v1/attendance/mark` — Submit final verified attendance record
- `GET  /api/v1/attendance/today` — Retrieve today's attendance record
- `GET  /api/v1/attendance/history` — Retrieve past attendance records

### Admin (`/api/v1/admin`)
- `POST   /api/v1/admin/faculty` — Provision a new faculty member
- `GET    /api/v1/admin/faculty` — List all faculty members
- `PATCH  /api/v1/admin/faculty/:id` — Update faculty profile / active status
- `DELETE /api/v1/admin/faculty/:id` — Delete faculty account
- `GET    /api/v1/admin/attendance` — View institution-wide attendance records
- `GET    /api/v1/admin/audit-logs` — Review system security & operational audit trail
- `GET    /api/v1/admin/attendance-zone` — View active attendance geofence zone
- `PUT    /api/v1/admin/attendance-zone` — Update geofence coordinates, radius, or accuracy constraints

---

## 📋 Response Standards

### Success Response (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {
    "attendance": {
      "id": "67a4e61f21ab29c0a1b2c3d4",
      "date": "2026-10-06",
      "distanceFromZone": 42.5,
      "status": "VERIFIED"
    }
  }
}
```

### Error Response (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "LOCATION_OUTSIDE_ZONE",
    "message": "You are outside the attendance zone.",
    "details": {
      "distanceFromZone": 284.1,
      "allowedRadius": 150,
      "zoneName": "Main Campus Geofence"
    }
  }
}
```
