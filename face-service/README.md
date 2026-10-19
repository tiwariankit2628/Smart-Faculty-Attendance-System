# Facial Verification Microservice (Python FastAPI)

Dedicated, independently deployable biometric verification and anti-spoofing microservice designed for the **Geo-Verified Faculty Attendance System**.

---

## 1. Responsibilities

1. **Face Detection**: Fast multi-scale frontal face detection using OpenCV computer vision algorithms.
2. **Image Quality Validation**: Pre-flight validation enforcing minimum dimensions ($150\times150\text{px}$), sharpness/blurriness checks via Laplacian variance ($\text{Var}(\nabla^2 I) \ge 65.0$), and lighting/exposure bounds ($40 \le \bar{I} \le 235$).
3. **Exactly-One-Face Validation**: Strictly rejects images containing zero faces (`NO_FACE_DETECTED`) or multiple faces (`MULTIPLE_FACES_DETECTED`) to eliminate proxy attendance attempts.
4. **Face Embedding Generation**: Extracts a 128-dimensional L2-normalized biometric feature representation vector from cropped, aligned facial regions of interest.
5. **Biometric Comparison**: Computes Cosine Similarity between live biometric capture and stored enrolled representation against configurable threshold (`SIMILARITY_THRESHOLD=0.75`).
6. **Anti-Spoofing Liveness Verification**: Passive multi-factor liveness analysis examining 2D FFT frequency spectrum (Moire / screen refresh detection), local gradient entropy (2D printout detection), and chromatic skin locus in YCrCb color space.
7. **Structured Verification Response**: Returns exact standardized output:
   ```json
   {
     "verified": true,
     "faceDetected": true,
     "livenessVerified": true,
     "confidence": 0.94
   }
   ```

---

## 2. API Endpoints

All endpoints under `/api/v1/face/*` require internal inter-service authentication via the `x-api-key` HTTP header.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/health` | Service health status & uptime check | No |
| `POST` | `/api/v1/face/enroll` | Enrolls faculty facial representation (returns opaque reference ID) | Yes (`x-api-key`) |
| `POST` | `/api/v1/face/verify` | Verifies live facial capture against enrolled reference representation | Yes (`x-api-key`) |
| `POST` | `/api/v1/face/liveness` | Standalone anti-spoofing and liveness assessment | Yes (`x-api-key`) |

---

## 3. Security Guarantees

- **No Exposure of Face Embeddings**: Raw 128-d biometric feature vectors are never transmitted over API responses. Responses return only boolean outcomes, confidence metrics, and opaque reference IDs (UUIDs).
- **Zero Biometric Logging**: The logger redacts any field containing images, base64 strings, or vector arrays. Log records contain only timestamps, endpoint routes, status codes, and execution duration.
- **Ephemeral In-Memory Processing**: Uploaded images are decoded directly in memory buffers (`io.BytesIO`) using Pillow and NumPy. Images are never written to disk.
- **Payload & File Type Validation**: Enforces a strict 10MB payload ceiling and validates magic byte headers for `image/jpeg`, `image/png`, and `image/webp`.
- **Inter-Service Protection**: Only the Node.js backend possessing `FACE_SERVICE_API_KEY` can invoke the service. Direct frontend access is blocked with HTTP 401/403.

---

## 4. Configuration (Environment Variables)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | Host address to bind |
| `PORT` | `8000` | Port number to bind |
| `FACE_SERVICE_API_KEY` | `internal_secret_face_service_key_7788` | Shared secret API key for backend calls |
| `SIMILARITY_THRESHOLD` | `0.75` | Minimum cosine similarity required for identity match |
| `LIVENESS_THRESHOLD` | `0.70` | Minimum score required for liveness verification |
| `MIN_IMAGE_DIMENSION` | `150` | Minimum width and height in pixels |
| `MAX_IMAGE_SIZE_BYTES`| `10485760` (10MB) | Maximum payload size in bytes |
| `BLUR_THRESHOLD` | `65.0` | Laplacian variance threshold for sharpness |
| `STORAGE_DIR` | `data/embeddings` | Storage location for enrolled reference representations |

---

## 5. Local Setup & Execution

### Prerequisites
- Python 3.10+ (tested on Python 3.12)

### 1. Install Dependencies
```bash
cd face-service
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start Service
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Service will be active on `http://localhost:8000`. Health check available at:
```bash
curl http://localhost:8000/health
```

---

## 6. Docker Deployment

### Run Standalone via Docker Compose:
```bash
cd face-service
docker compose up -d --build
```

### Run via Docker CLI:
```bash
docker build -t lpu-face-verification-service .
docker run -d -p 8000:8000 \
  -e FACE_SERVICE_API_KEY=internal_secret_face_service_key_7788 \
  --name face-service lpu-face-verification-service
```

---

## 7. Running Automated Tests

Run the complete test suite:
```bash
cd face-service
pytest tests/test_face_api.py -v
```
