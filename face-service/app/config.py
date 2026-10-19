from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized Configuration for Face Verification FastAPI Service.
    Values are loaded from environment variables or .env file.
    """
    # Service Network
    HOST: str = Field(default="0.0.0.0", description="Host address to bind")
    PORT: int = Field(default=8000, description="Port number to bind")
    ENVIRONMENT: str = Field(default="production", description="Environment runtime mode")
    DEBUG: bool = Field(default=False, description="Debug flag")

    # Inter-Service Authentication
    FACE_SERVICE_API_KEY: str = Field(
        default="internal_secret_face_service_key_7788",
        description="Shared secret API key for backend authentication",
    )

    # CORS configuration - restricted to backend origins
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:5000", "http://127.0.0.1:5000"],
        description="Allowed CORS origins",
    )

    # Face Verification & Biometric Thresholds (Deep Learning SFace Model)
    SIMILARITY_THRESHOLD: float = Field(
        default=0.65,
        description="Cosine similarity threshold for positive identity verification against registered profile",
    )
    L2_DISTANCE_THRESHOLD: float = Field(
        default=0.85,
        description="Maximum L2 Euclidean distance threshold for positive biometric match",
    )
    LIVENESS_THRESHOLD: float = Field(
        default=0.55,
        description="Minimum score required to verify genuine liveness / anti-spoofing",
    )
    YUNET_MODEL_PATH: str = Field(
        default="app/weights/face_detection_yunet_2023mar.onnx",
        description="Path to YuNet face detection ONNX model",
    )
    SFACE_MODEL_PATH: str = Field(
        default="app/weights/face_recognition_sface_2021dec.onnx",
        description="Path to SFace face recognition ONNX model",
    )

    # Image Quality Thresholds
    MIN_IMAGE_DIMENSION: int = Field(
        default=100,
        description="Minimum width and height in pixels for candidate face image",
    )
    MAX_IMAGE_SIZE_BYTES: int = Field(
        default=10 * 1024 * 1024,
        description="Maximum permitted payload size in bytes (10MB)",
    )
    BLUR_THRESHOLD: float = Field(
        default=25.0,
        description="Laplacian variance threshold below which images are rejected as blurry",
    )
    MIN_BRIGHTNESS: float = Field(
        default=22.0,
        description="Minimum mean pixel intensity (0-255) to prevent underexposed images",
    )
    MAX_BRIGHTNESS: float = Field(
        default=240.0,
        description="Maximum mean pixel intensity (0-255) to prevent overexposed images",
    )

    # Storage Path for Enrolled Face Embeddings
    STORAGE_DIR: str = Field(
        default="data/embeddings",
        description="Directory for persisting reference biometric embeddings",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
