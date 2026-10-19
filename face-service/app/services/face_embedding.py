import json
import os
import uuid
import hashlib
from typing import Dict, Optional, Tuple
import cv2
import numpy as np
from app.config import settings
from app.utils.logger import logger


class FaceEmbeddingManager:
    """
    Manages generation, storage, and matching of biometric face embeddings.
    
    Security Guarantees:
    - Never returns raw embedding vectors via API responses.
    - Embeddings are indexed by opaque reference IDs (UUIDs).
    - In-memory cache with persistent file storage.
    - Seeded support for existing faculty reference IDs (e.g., face_emb_faculty_lpu_101).
    """

    def __init__(self):
        storage_path = os.path.join(settings.STORAGE_DIR, "enrolled_embeddings.json")
        if not os.path.isabs(storage_path):
            face_svc_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            candidates = [
                os.path.join(face_svc_root, "data", "embeddings", "enrolled_embeddings.json"),
                os.path.join(os.getcwd(), storage_path),
                os.path.join(os.getcwd(), "face-service", storage_path),
            ]
            for c in candidates:
                if os.path.exists(c):
                    storage_path = c
                    break
        self._storage_path = storage_path
        self._memory_store: Dict[str, dict] = {}
        self._ensure_storage()
        self._load_store()

        # Load OpenCV SFace deep face recognition ONNX model
        self._sface = None
        sface_path = settings.SFACE_MODEL_PATH
        if not os.path.isabs(sface_path):
            candidates = [
                os.path.join(os.getcwd(), sface_path),
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weights", os.path.basename(sface_path)),
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "face-service", sface_path),
            ]
            for c in candidates:
                if os.path.exists(c):
                    sface_path = c
                    break

        if os.path.exists(sface_path) and hasattr(cv2, "FaceRecognizerSF"):
            try:
                self._sface = cv2.FaceRecognizerSF.create(sface_path, "")
                logger.info("Successfully loaded SFace deep neural network model from: %s", sface_path)
            except Exception as e:
                logger.error("Failed to load SFace deep face recognizer: %s", str(e))

    def _ensure_storage(self) -> None:
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)
        if not os.path.exists(self._storage_path):
            with open(self._storage_path, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _load_store(self) -> None:
        try:
            if os.path.exists(self._storage_path):
                with open(self._storage_path, "r", encoding="utf-8") as f:
                    self._memory_store = json.load(f)
        except Exception as e:
            logger.error("Failed to load embeddings store: %s", str(e))
            self._memory_store = {}

    def _save_store(self) -> None:
        try:
            # Atomic file write: write to temp file then atomic replace to prevent corruption across workers
            tmp_path = f"{self._storage_path}.tmp.{os.getpid()}"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self._memory_store, f, indent=2)
            os.replace(tmp_path, self._storage_path)
        except Exception as e:
            logger.error("Failed to persist embeddings store: %s", str(e))

    def generate_embedding(
        self,
        face_roi: np.ndarray,
        img_bgr: Optional[np.ndarray] = None,
        face_raw: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Generates a 128-dimensional normalized facial biometric embedding vector.
        Uses SFace (Deep Learning CNN Face Recognition Model) with 5-point landmark alignment.
        """
        if self._sface is not None:
            try:
                # 1. Use landmark-aligned crop if full image and YuNet landmarks are provided
                if img_bgr is not None and face_raw is not None:
                    aligned_face = self._sface.alignCrop(img_bgr, face_raw)
                else:
                    aligned_face = cv2.resize(face_roi, (112, 112))

                raw_feature = self._sface.feature(aligned_face)
                # L2 Unit Normalization
                norm = np.linalg.norm(raw_feature) + 1e-6
                unit_embedding = (raw_feature / norm).flatten().astype(np.float32)
                return unit_embedding
            except Exception as e:
                logger.warning("SFace feature extraction failed (%s), falling back to spatial descriptor", str(e))

        # Fallback multi-cell spatial descriptor if deep model is unavailable
        aligned_face = cv2.resize(face_roi, (128, 128))
        gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
        equalized = cv2.equalizeHist(gray)

        gx = cv2.Sobel(equalized, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(equalized, cv2.CV_32F, 0, 1, ksize=3)
        mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

        cell_size = 32
        num_bins = 8
        bin_width = 360.0 / num_bins
        embedding = []

        for row in range(4):
            for col in range(4):
                cell_mag = mag[row * cell_size : (row + 1) * cell_size, col * cell_size : (col + 1) * cell_size]
                cell_ang = ang[row * cell_size : (row + 1) * cell_size, col * cell_size : (col + 1) * cell_size]

                hist = np.zeros(num_bins, dtype=np.float32)
                for b in range(num_bins):
                    bin_min = b * bin_width
                    bin_max = (b + 1) * bin_width
                    mask = (cell_ang >= bin_min) & (cell_ang < bin_max)
                    hist[b] = np.sum(cell_mag[mask])

                cell_norm = np.linalg.norm(hist) + 1e-6
                hist = hist / cell_norm
                embedding.extend(hist.tolist())

        embedding_vector = np.array(embedding, dtype=np.float32)
        l2_norm = np.linalg.norm(embedding_vector) + 1e-6
        return embedding_vector / l2_norm

    def enroll_face(self, faculty_id: str, embedding: np.ndarray) -> str:
        """
        Stores enrolled face embedding for facultyId.
        Returns a secure, opaque reference ID. Does NOT return the embedding vector.
        """
        reference_id = f"face_emb_{faculty_id}_{uuid.uuid4().hex[:12]}"
        
        record = {
            "facultyId": faculty_id,
            "referenceId": reference_id,
            "embedding": embedding.tolist(),
            "model": "sface_v1",
            "enrolledAt": int(np.datetime64("now").astype("int64")),
        }

        self._memory_store[reference_id] = record
        # Also index by facultyId for direct lookup
        self._memory_store[f"faculty_{faculty_id}"] = record
        self._save_store()

        logger.info("Enrolled deep biometric face embedding for facultyId: %s (reference: %s)", faculty_id, reference_id)
        return reference_id

    def get_enrolled_embedding(
        self, faculty_id: str, reference_id: Optional[str] = None
    ) -> Optional[np.ndarray]:
        """
        Retrieves enrolled embedding vector from secure internal store.
        Strictly enforces that the retrieved embedding belongs exclusively to the requested faculty_id.
        """
        # 1. If reference_id is provided, verify it belongs to this specific faculty_id
        if reference_id and reference_id in self._memory_store:
            record = self._memory_store[reference_id]
            if isinstance(record, dict):
                rec_fac = record.get("facultyId")
                # Ensure record belongs to this faculty (or is a valid format face_emb_<facultyId>_...)
                if rec_fac == faculty_id or reference_id.startswith(f"face_emb_{faculty_id}_"):
                    return np.array(record["embedding"], dtype=np.float32)
                
                logger.warning(
                    "Security violation: Reference ID %s does not belong to faculty %s (registered to %s)",
                    reference_id, faculty_id, rec_fac
                )
                return None

        # 2. Try direct facultyId lookup
        fac_key = f"faculty_{faculty_id}"
        if fac_key in self._memory_store:
            rec = self._memory_store[fac_key]
            if isinstance(rec, dict) and "embedding" in rec:
                return np.array(rec["embedding"], dtype=np.float32)

        # 3. Search memory store for records registered to this specific facultyId
        for record in self._memory_store.values():
            if isinstance(record, dict) and record.get("facultyId") == faculty_id:
                return np.array(record["embedding"], dtype=np.float32)

        return None

    def verify_candidate_embedding(self, candidate_reference: str, faculty_id: str) -> bool:
        """
        Validates that candidate embedding exists and belongs to the specified faculty.
        """
        if not candidate_reference or candidate_reference not in self._memory_store:
            return False
        record = self._memory_store[candidate_reference]
        if not isinstance(record, dict):
            return False
        rec_fac = str(record.get("facultyId", ""))
        # Candidate was registered under candidate_<faculty_id>_<timestamp> or matches faculty_id
        if (
            rec_fac == faculty_id
            or rec_fac.startswith(f"candidate_{faculty_id}_")
            or candidate_reference.startswith(f"face_emb_candidate_{faculty_id}_")
        ):
            return True
        return False

    def activate_candidate_embedding(self, candidate_reference: str, faculty_id: str) -> Optional[str]:
        """
        Atomically promotes a candidate embedding into an active faculty profile.
        Safely purges the temporary candidate embedding upon successful activation.
        """
        if not self.verify_candidate_embedding(candidate_reference, faculty_id):
            return None
        candidate_record = self._memory_store[candidate_reference]
        embedding_list = candidate_record.get("embedding")
        if not embedding_list:
            return None
        embedding = np.array(embedding_list, dtype=np.float32)
        new_active_ref = self.enroll_face(faculty_id, embedding)
        # Purge temporary candidate key
        self.delete_embedding(candidate_reference)
        candidate_fac_id = candidate_record.get("facultyId")
        if candidate_fac_id and str(candidate_fac_id).startswith("candidate_"):
            self._memory_store.pop(f"faculty_{candidate_fac_id}", None)
        self._save_store()
        logger.info(
            "Activated candidate embedding %s -> active %s for faculty %s",
            candidate_reference,
            new_active_ref,
            faculty_id,
        )
        return new_active_ref

    def delete_embedding(self, reference_id: str) -> bool:
        """
        Safely purges an embedding by reference ID from memory and disk store.
        If the active pointer for a faculty member was deleted during a rollback,
        restores the active pointer to their previous valid enrolled embedding if one exists.
        """
        if not reference_id:
            return False
        deleted = False
        if reference_id in self._memory_store:
            record = self._memory_store.pop(reference_id)
            deleted = True
            fac_id = record.get("facultyId") if isinstance(record, dict) else None
            if fac_id and self._memory_store.get(f"faculty_{fac_id}", {}).get("referenceId") == reference_id:
                self._memory_store.pop(f"faculty_{fac_id}", None)
                # Rollback safety: restore active pointer to previous enrollment if available
                for other_ref, other_rec in self._memory_store.items():
                    if (
                        isinstance(other_rec, dict)
                        and other_rec.get("facultyId") == fac_id
                        and other_rec.get("referenceId") != reference_id
                        and not str(other_ref).startswith("candidate_")
                        and not str(other_rec.get("referenceId", "")).startswith("candidate_")
                    ):
                        self._memory_store[f"faculty_{fac_id}"] = other_rec
                        break
            self._save_store()
            logger.info("Purged embedding reference %s from store", reference_id)
        return deleted

    def compare_embeddings(
        self, embedding_a: Optional[np.ndarray], embedding_b: Optional[np.ndarray]
    ) -> Tuple[bool, float, float]:
        """
        Computes dual-metric biometric comparison:
        1. Cosine Similarity: dot(a, b) / (||a|| * ||b||), higher is closer.
        2. L2 Euclidean Distance: ||a - b||, lower is closer.

        Fail Closed Policy:
        - If either vector is None, empty, or invalid, returns (False, 0.0, 2.0).
        - Identity Match strictly requires BOTH metrics to pass independently:
            cosine_passes = (similarity >= settings.SIMILARITY_THRESHOLD)
            l2_passes = (l2_dist <= settings.L2_DISTANCE_THRESHOLD)
            identity_match = cosine_passes and l2_passes
        """
        # Fail closed on missing, empty, or invalid inputs
        if embedding_a is None or embedding_b is None:
            return False, 0.0, 2.0

        if not isinstance(embedding_a, np.ndarray) or not isinstance(embedding_b, np.ndarray):
            return False, 0.0, 2.0

        if embedding_a.size == 0 or embedding_b.size == 0:
            return False, 0.0, 2.0

        try:
            a = embedding_a.flatten().astype(np.float32)
            b = embedding_b.flatten().astype(np.float32)

            if len(a) != 128 or len(b) != 128:
                logger.error("Embedding dimension mismatch: len(a)=%d, len(b)=%d (expected 128)", len(a), len(b))
                return False, 0.0, 2.0

            norm_a = float(np.linalg.norm(a)) + 1e-6
            norm_b = float(np.linalg.norm(b)) + 1e-6

            # 1. Cosine similarity
            dot_product = float(np.dot(a, b))
            raw_cosine = dot_product / (norm_a * norm_b)
            similarity = max(0.0, min(1.0, raw_cosine))

            # 2. L2 Euclidean distance between unit-normalized vectors
            diff = (a / norm_a) - (b / norm_b)
            l2_dist = float(np.linalg.norm(diff))

            # 3. Explicit dual evaluation: BOTH must satisfy thresholds
            cosine_passes = bool(similarity >= settings.SIMILARITY_THRESHOLD)
            l2_passes = bool(l2_dist <= settings.L2_DISTANCE_THRESHOLD)

            # Neither metric can override a failure in the other
            identity_match = bool(cosine_passes and l2_passes)

            return identity_match, round(similarity, 4), round(l2_dist, 4)
        except Exception as e:
            logger.error("Unexpected biometric comparison error (%s). Failing closed.", str(e))
            return False, 0.0, 2.0


face_embedding_manager = FaceEmbeddingManager()
