import os
from dataclasses import dataclass
from typing import Optional, Tuple
import cv2
import numpy as np
from app.config import settings
from app.utils.logger import logger


@dataclass
class FaceDetectionResult:
    detected: bool
    face_count: int
    bounding_box: Optional[Tuple[int, int, int, int]] = None  # (x, y, w, h)
    face_roi: Optional[np.ndarray] = None
    face_raw: Optional[np.ndarray] = None  # 15-element array containing 5 facial landmarks
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class FaceDetector:
    """
    Robust Face Detector responsible for:
    1. Detecting frontal human faces using deep learning YuNet ONNX model.
    2. Fallback to OpenCV Haar Cascades if needed.
    3. Strict 'Exactly One Face' validation (rejects 0 faces and rejects > 1 faces).
    4. Providing 5-point facial landmarks for geometric alignment.
    """

    def __init__(self):
        self.yunet = None
        yunet_path = settings.YUNET_MODEL_PATH
        if not os.path.isabs(yunet_path):
            candidates = [
                os.path.join(os.getcwd(), yunet_path),
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "weights", os.path.basename(yunet_path)),
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "face-service", yunet_path),
            ]
            for c in candidates:
                if os.path.exists(c):
                    yunet_path = c
                    break

        if os.path.exists(yunet_path) and hasattr(cv2, "FaceDetectorYN"):
            try:
                self.yunet = cv2.FaceDetectorYN.create(
                    yunet_path,
                    "",
                    (320, 320),
                    score_threshold=0.6,
                    nms_threshold=0.3,
                    top_k=5000,
                )
                logger.info("Successfully loaded YuNet face detector from: %s", yunet_path)
            except Exception as e:
                logger.warning("Failed to initialize YuNet face detector (%s), using Haar fallback", str(e))

        # OpenCV Haar fallback cascades
        alt2_path = cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"
        self.face_cascade_alt2 = cv2.CascadeClassifier(alt2_path)
        default_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.face_cascade_default = cv2.CascadeClassifier(default_path)
        eye_cascade_path = cv2.data.haarcascades + "haarcascade_eye.xml"
        self.eye_cascade = cv2.CascadeClassifier(eye_cascade_path)

    def detect_face(self, img_bgr: np.ndarray) -> FaceDetectionResult:
        img_h, img_w = img_bgr.shape[:2]

        # 1. Primary Deep Learning Detection via YuNet
        if self.yunet is not None:
            try:
                self.yunet.setInputSize((img_w, img_h))
                _, raw_faces = self.yunet.detect(img_bgr)
                if raw_faces is not None and len(raw_faces) > 0:
                    if len(raw_faces) > 1:
                        boxes = [
                            [int(f[0]), int(f[1]), int(f[2]), int(f[3])]
                            for f in raw_faces
                        ]
                        filtered = self._filter_overlapping_boxes(np.array(boxes))
                        if len(filtered) > 1:
                            return FaceDetectionResult(
                                detected=False,
                                face_count=len(filtered),
                                error_code="MULTIPLE_FACES_DETECTED",
                                error_message="Multiple faces detected. Please ensure only one person is visible.",
                            )
                        # Keep the dominant face
                        raw_faces = [raw_faces[0]]

                    face = raw_faces[0]
                    x, y, w, h = int(face[0]), int(face[1]), int(face[2]), int(face[3])
                    pad_x = int(0.1 * w)
                    pad_y = int(0.1 * h)
                    x1 = max(0, x - pad_x)
                    y1 = max(0, y - pad_y)
                    x2 = min(img_w, x + w + pad_x)
                    y2 = min(img_h, y + h + pad_y)
                    face_roi = img_bgr[y1:y2, x1:x2]

                    return FaceDetectionResult(
                        detected=True,
                        face_count=1,
                        bounding_box=(x, y, w, h),
                        face_roi=face_roi,
                        face_raw=face,
                    )
            except Exception as e:
                logger.warning("YuNet detection error (%s), attempting Haar fallback", str(e))

        # 2. Fallback Detection via OpenCV Haar Cascades
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        equalized = cv2.equalizeHist(gray)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_gray = clahe.apply(gray)

        faces = self.face_cascade_alt2.detectMultiScale(
            equalized,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(50, 50),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        if len(faces) == 0:
            faces = self.face_cascade_alt2.detectMultiScale(
                clahe_gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(40, 40),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )

        if len(faces) == 0:
            faces = self.face_cascade_default.detectMultiScale(
                equalized,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(50, 50),
                flags=cv2.CASCADE_SCALE_IMAGE,
            )

        face_count = len(faces)
        if face_count == 0:
            return FaceDetectionResult(
                detected=False,
                face_count=0,
                error_code="NO_FACE_DETECTED",
                error_message="No face detected. Please position your face clearly in the camera.",
            )

        if face_count > 1:
            filtered_faces = self._filter_overlapping_boxes(faces)
            if len(filtered_faces) > 1:
                return FaceDetectionResult(
                    detected=False,
                    face_count=len(filtered_faces),
                    error_code="MULTIPLE_FACES_DETECTED",
                    error_message="Multiple faces detected. Please ensure only one person is visible.",
                )
            faces = filtered_faces

        x, y, w, h = faces[0]
        pad_x = int(0.1 * w)
        pad_y = int(0.1 * h)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(img_w, x + w + pad_x)
        y2 = min(img_h, y + h + pad_y)
        face_roi = img_bgr[y1:y2, x1:x2]

        return FaceDetectionResult(
            detected=True,
            face_count=1,
            bounding_box=(x, y, w, h),
            face_roi=face_roi,
            face_raw=None,
        )

    def _filter_overlapping_boxes(self, boxes: np.ndarray) -> list:
        """
        Suppresses redundant bounding boxes that overlap significantly (IoU > 0.3)
        """
        if len(boxes) <= 1:
            return list(boxes)

        selected = []
        # Sort boxes by area descending
        sorted_boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)

        for b1 in sorted_boxes:
            overlap = False
            for b2 in selected:
                if self._compute_iou(b1, b2) > 0.3:
                    overlap = True
                    break
            if not overlap:
                selected.append(b1)

        return selected

    def _compute_iou(self, boxA, boxB) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
        yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = boxA[2] * boxA[3]
        boxBArea = boxB[2] * boxB[3]

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
        return float(iou)


face_detector = FaceDetector()
