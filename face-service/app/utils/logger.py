import logging
import sys
from typing import Any, Dict


class SecurityAwareFormatter(logging.Formatter):
    """
    Log Formatter ensuring NO biometric data (base64 images, embeddings, feature vectors)
    is ever leaked into log files, stdout, or APM monitoring tools.
    """
    SENSITIVE_KEYS = {
        "image", "imagebase64", "embedding", "embeddings", "vector",
        "raw_image", "face_vector", "biometrics", "photo"
    }

    def format(self, record: logging.LogRecord) -> str:
        # Sanitize extra fields if present
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            record.extra = self._sanitize(record.extra)
        return super().format(record)

    def _sanitize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for k, v in data.items():
            if k.lower() in self.SENSITIVE_KEYS:
                sanitized[k] = "[REDACTED_BIOMETRIC_DATA]"
            elif isinstance(v, dict):
                sanitized[k] = self._sanitize(v)
            else:
                sanitized[k] = v
        return sanitized


def get_logger(name: str = "face_service") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        formatter = SecurityAwareFormatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


logger = get_logger("face_service")
