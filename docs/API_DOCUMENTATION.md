# REST API Documentation — Geo-Verified Faculty Attendance System

Base URL: `http://localhost:5000/api/v1`

All responses follow a standardized JSON envelope.

---

## 🔐 1. Authentication APIs

### 1.1 POST `/auth/login`
Authenticates a user using email and password. Sets an HTTP-only secure cookie named `access_token` and also returns the token in the JSON body.

- **Rate Limit**: 20 requests / 15 minutes per IP
- **Request Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "faculty@college.edu",
    "password": "FacultyPassword@123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "67a4e61f21ab29c0a1b2c3d4",
        "name": "Dr. John Doe",
        "email": "faculty@college.edu",
        "employeeId": "EMP-FAC-001",
        "role": "FACULTY",
        "department": "Computer Science & Engineering",
        "isActive": true,
        "createdAt": "2026-10-06T06:00:00.000Z",
        "updatedAt": "2026-10-06T06:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized` (`INVALID_CREDENTIALS`): Invalid email or password.
  - `401 Unauthorized` (`ACCOUNT_DEACTIVATED`): Account has been disabled.

---

### 1.2 POST `/auth/logout`
Clears the `access_token` HTTP-only cookie and creates a security audit trail log.

- **Request Headers**:
  - `Cookie: access_token=...` OR `Authorization: Bearer <token>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Successfully logged out."
    }
  }
  ```

---

### 1.3 GET `/auth/me`
Fetches the profile of the currently logged-in user.

- **Request Headers**:
  - `Cookie: access_token=...` OR `Authorization: Bearer <token>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "67a4e61f21ab29c0a1b2c3d4",
        "name": "Dr. John Doe",
        "email": "faculty@college.edu",
        "employeeId": "EMP-FAC-001",
        "role": "FACULTY",
        "department": "Computer Science & Engineering",
        "faceEmbeddingReference": "ref_emb_998811",
        "isActive": true
      }
    }
  }
  ```

---

## 👩‍🏫 2. Faculty APIs

### 2.1 GET `/faculty/profile`
Retrieves faculty profile details.
- **Roles**: `FACULTY`, `ADMIN`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "profile": {
        "id": "67a4e61f21ab29c0a1b2c3d4",
        "name": "Dr. John Doe",
        "email": "faculty@college.edu",
        "employeeId": "EMP-FAC-001",
        "department": "Computer Science & Engineering",
        "faceEmbeddingReference": "ref_emb_998811",
        "isActive": true
      }
    }
  }
  ```

---

### 2.2 GET `/faculty/attendance`
Retrieves personal attendance history and status for today.
- **Query Parameters**:
  - `limit` *(optional)*: Maximum records to return (default: `60`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "records": [
        {
          "id": "67a501aa21ab29c0a1b2c3d8",
          "facultyId": "67a4e61f21ab29c0a1b2c3d4",
          "date": "2026-10-06",
          "timestamp": "2026-10-06T09:15:30.000Z",
          "latitude": 28.61398,
          "longitude": 77.20905,
          "distanceFromZone": 12.3,
          "locationVerified": true,
          "faceVerified": true,
          "livenessVerified": true,
          "status": "VERIFIED"
        }
      ],
      "hasMarkedToday": true,
      "todayRecord": { ... },
      "totalRecords": 1
    }
  }
  ```

---

### 2.3 POST `/faculty/face-registration`
Enrolls facial biometrics by sending an image to the Python FastAPI microservice to generate and store a persistent embedding reference.
- **Roles**: `FACULTY`
- **Request Body**:
  ```json
  {
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "registered": true,
      "employeeId": "EMP-FAC-001",
      "message": "Facial biometrics registered successfully."
    }
  }
  ```
- **Error Responses**:
  - `503 Service Unavailable` (`FACE_SERVICE_UNAVAILABLE`): External Python face recognition microservice is offline or unreachable.

---

## 📍 3. Attendance APIs

### 3.1 POST `/attendance/verify-location`
Calculates distance server-side using the **Haversine formula** between client GPS coordinates and active geofence center. Upon success, returns a 5-minute Redis-backed location token.

- **Request Body**:
  ```json
  {
    "latitude": 28.614012,
    "longitude": 77.209045,
    "accuracy": 14.5
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "locationVerified": true,
      "distanceFromZone": 18.2,
      "zoneName": "Main Campus Geofence",
      "allowedRadiusMeters": 150,
      "locationToken": "loc_8fd4a179-8b43-42e5-bc09-0d1c7eb1129b"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (`LOCATION_OUTSIDE_ZONE`):
    ```json
    {
      "success": false,
      "error": {
        "code": "LOCATION_OUTSIDE_ZONE",
        "message": "You are outside the attendance zone.",
        "details": {
          "distanceFromZone": 240.5,
          "allowedRadius": 150,
          "zoneName": "Main Campus Geofence"
        }
      }
    }
    ```
  - `400 Bad Request` (`GPS_ACCURACY_TOO_LOW`): Accuracy radius exceeds allowed threshold (e.g. > 35m).

---

### 3.2 POST `/attendance/verify-face`
Validates biometric capture and liveness against stored embedding reference by delegating to Python FastAPI face service. Upon success, issues a 5-minute Redis-backed face token.

- **Request Body**:
  ```json
  {
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "challengeToken": "chl_optional_active_liveness_nonce"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "faceVerified": true,
      "livenessVerified": true,
      "faceConfidence": 0.96,
      "livenessScore": 0.98,
      "faceToken": "face_7da21e05-23c2-4091-a8bb-d6023be62f88"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (`FACE_NOT_REGISTERED`): Faculty has not registered biometrics yet.
  - `400 Bad Request` (`FACE_VERIFICATION_FAILED`): Face does not match registered profile.
  - `400 Bad Request` (`LIVENESS_FAILED`): Spoof attempt detected.
  - `503 Service Unavailable` (`FACE_SERVICE_UNAVAILABLE`): Python face service offline.

---

### 3.3 POST `/attendance/mark`
Submits final attendance record. Performs server-side date validation, geofencing, duplicate checks, idempotency, and stores record in MongoDB.

- **Request Body**:
  ```json
  {
    "latitude": 28.614012,
    "longitude": 77.209045,
    "accuracy": 14.5,
    "locationToken": "loc_8fd4a179-8b43-42e5-bc09-0d1c7eb1129b",
    "faceToken": "face_7da21e05-23c2-4091-a8bb-d6023be62f88",
    "idempotencyKey": "uuid_from_client_session_12345"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "67a501aa21ab29c0a1b2c3d8",
      "facultyId": "67a4e61f21ab29c0a1b2c3d4",
      "date": "2026-10-06",
      "timestamp": "2026-10-06T09:15:30.000Z",
      "latitude": 28.614012,
      "longitude": 77.209045,
      "distanceFromZone": 18.2,
      "locationVerified": true,
      "faceVerified": true,
      "livenessVerified": true,
      "status": "VERIFIED",
      "verificationMetadata": {
        "faceConfidence": 0.96,
        "livenessScore": 0.98,
        "accuracyMeters": 14.5,
        "zoneName": "Main Campus Geofence"
      }
    }
  }
  ```
- **Error Responses**:
  - `409 Conflict` (`DUPLICATE_ATTENDANCE`): Attendance has already been marked for today.
  - `409 Conflict` (`CONCURRENT_ATTENDANCE_REQUEST`): Submission already in progress.
  - `400 Bad Request` (`LOCATION_OUTSIDE_ZONE`): Outside active geofence.

---

### 3.4 GET `/attendance/today`
Retrieves current faculty member's attendance record for the current server date.

- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "attendance": { ... } // Or null if not yet marked today
    }
  }
  ```

---

### 3.5 GET `/attendance/history`
Retrieves past personal attendance history for current faculty.

- **Query Parameters**:
  - `limit` *(optional)*: Maximum records (default: `30`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "records": [ ... ]
    }
  }
  ```

---

## 🛡️ 4. Admin APIs

Requires `role: "ADMIN"`.

### 4.1 POST `/admin/faculty`
Provisions a new faculty member.
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Connor",
    "email": "sarah.connor@college.edu",
    "employeeId": "EMP-FAC-002",
    "password": "FacultySecurePassword@123",
    "department": "Mechanical Engineering"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "faculty": {
        "id": "67a502ff21ab29c0a1b2c3e1",
        "name": "Dr. Sarah Connor",
        "email": "sarah.connor@college.edu",
        "employeeId": "EMP-FAC-002",
        "role": "FACULTY",
        "department": "Mechanical Engineering",
        "isActive": true
      }
    }
  }
  ```

---

### 4.2 GET `/admin/faculty`
Lists all registered faculty members.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "faculty": [ ... ]
    }
  }
  ```

---

### 4.3 PATCH `/admin/faculty/:id`
Updates faculty details or activation status.
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Connor-Reese",
    "department": "Robotics & Automation",
    "isActive": true
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "faculty": { ... }
    }
  }
  ```

---

### 4.4 DELETE `/admin/faculty/:id`
Removes faculty member.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "deleted": true,
      "id": "67a502ff21ab29c0a1b2c3e1"
    }
  }
  ```

---

### 4.5 GET `/admin/attendance`
Retrieves institution-wide attendance records with multi-criteria filters.
- **Query Parameters**:
  - `date`: Filter by `YYYY-MM-DD`
  - `facultyId`: Filter by faculty MongoDB ID
  - `status`: `VERIFIED` | `REJECTED` | `FLAGGED`
  - `limit`: Number of records (default: `100`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "records": [ ... ]
    }
  }
  ```

---

### 4.6 GET `/admin/audit-logs`
Reviews tamper-evident security and operational audit logs.
- **Query Parameters**:
  - `limit`: Max logs to retrieve (default: `100`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "logs": [
        {
          "id": "67a503dd21ab29c0a1b2c3f0",
          "userId": "67a4e61f21ab29c0a1b2c3d4",
          "action": "ATTENDANCE_MARKED",
          "timestamp": "2026-10-06T09:15:30.000Z",
          "requestId": "550e8400-e29b-41d4-a716-446655440000",
          "metadata": {
            "date": "2026-10-06",
            "distanceFromZone": 18.2,
            "status": "VERIFIED"
          }
        }
      ]
    }
  }
  ```

---

### 4.7 GET `/admin/attendance-zone`
Retrieves the active geofence zone configuration.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "zone": {
        "id": "67a4e50021ab29c0a1b2c300",
        "name": "Main Campus Geofence",
        "latitude": 28.613939,
        "longitude": 77.209021,
        "radiusMeters": 150,
        "maxAllowedAccuracyMeters": 35,
        "isActive": true
      }
    }
  }
  ```

---

### 4.8 PUT `/admin/attendance-zone`
Updates or creates the active geofence zone.
- **Request Body**:
  ```json
  {
    "name": "North Academic Campus",
    "latitude": 28.614500,
    "longitude": 77.209500,
    "radiusMeters": 200,
    "maxAllowedAccuracyMeters": 40,
    "isActive": true
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "zone": { ... }
    }
  }
  ```

---

## ⚠️ Error Codes Dictionary

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body or query parameter structure. |
| `INVALID_COORDINATES` | 400 | Latitude/Longitude outside [-90, 90] / [-180, 180]. |
| `GPS_ACCURACY_TOO_LOW` | 400 | GPS accuracy radius exceeds allowed threshold. |
| `LOCATION_OUTSIDE_ZONE` | 400 | Calculated Haversine distance is outside active geofence radius. |
| `LOCATION_TOKEN_EXPIRED` | 400 | Short-lived location verification token expired (> 5 min). |
| `FACE_NOT_REGISTERED` | 400 | Faculty has not yet enrolled biometrics. |
| `FACE_VERIFICATION_FAILED` | 400 | Face did not match registered biometric embedding. |
| `LIVENESS_FAILED` | 400 | Face liveness failed (potential spoof/photo attack). |
| `FACE_TOKEN_EXPIRED` | 400 | Short-lived face verification token expired (> 5 min). |
| `UNAUTHORIZED` | 401 | Missing, malformed, or expired authentication token. |
| `INVALID_CREDENTIALS` | 401 | Incorrect email or password. |
| `ACCOUNT_DEACTIVATED` | 401 | User account has been deactivated. |
| `FORBIDDEN` | 403 | Authenticated user lacks required role permissions. |
| `NOT_FOUND` | 404 | Endpoint or database record does not exist. |
| `CONFLICT` | 409 | Unique constraint violation (e.g. duplicate email). |
| `DUPLICATE_ATTENDANCE` | 409 | Attendance record already exists for this faculty and date. |
| `CONCURRENT_ATTENDANCE_REQUEST` | 409 | Parallel attendance submission in flight. |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests submitted in a given time window. |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server exception. |
| `FACE_SERVICE_UNAVAILABLE` | 503 | External Python FastAPI face service offline or unreachable. |
