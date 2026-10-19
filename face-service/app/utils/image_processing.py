import base64
import io
import re
from typing import Tuple
import numpy as np
from PIL import Image, ImageOps
import cv2
from fastapi import HTTPException, status
from app.config import settings


# Magic byte signatures for supported image formats
MAGIC_NUMBERS = {
    b"\xff\xd8\xff": "JPEG",
    b"\x89PNG\r\n\x1a\n": "PNG",
    b"RIFF": "WEBP",
}


def sanitize_base64_string(raw_str: str) -> str:
    """
    Strips data URL prefix (e.g. data:image/jpeg;base64,) and whitespace.
    """
    if "," in raw_str:
        return raw_str.split(",", 1)[1].strip()
    return raw_str.strip()


def validate_image_bytes(image_bytes: bytes) -> str:
    """
    Enforces payload size limits and validates magic header bytes to ensure
    the upload is a genuine JPEG, PNG, or WebP image.
    """
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_IMAGE", "message": "The provided image payload is empty."},
        )

    if len(image_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "IMAGE_TOO_LARGE",
                "message": f"Image size exceeds maximum allowed limit of {settings.MAX_IMAGE_SIZE_BYTES // (1024*1024)}MB.",
            },
        )

    # Validate image signature
    is_valid_format = False
    detected_format = ""

    if image_bytes.startswith(b"\xff\xd8\xff"):
        is_valid_format = True
        detected_format = "JPEG"
    elif image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_format = True
        detected_format = "PNG"
    elif image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:16]:
        is_valid_format = True
        detected_format = "WEBP"

    if not is_valid_format:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "UNSUPPORTED_IMAGE_FORMAT",
                "message": "Only JPEG, PNG, and WebP image formats are accepted.",
            },
        )

    return detected_format


def decode_image_to_cv2(image_input: str) -> np.ndarray:
    """
    Decodes a base64 encoded string directly into a BGR OpenCV NumPy array entirely in memory.
    Ensures images are not written to disk and cleans up buffers immediately.
    """
    cleaned_b64 = sanitize_base64_string(image_input)

    try:
        raw_bytes = base64.b64decode(cleaned_b64, validate=True)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_BASE64", "message": "Failed to decode base64 image data."},
        )

    # Enforce magic bytes and file size limits
    validate_image_bytes(raw_bytes)

    try:
        # Load through Pillow to safely normalize EXIF rotation and convert color space
        with Image.open(io.BytesIO(raw_bytes)) as pil_img:
            # Handle orientation from EXIF if present
            pil_img = ImageOps.exif_transpose(pil_img)

            # Convert to RGB (drops alpha channel safely if PNG)
            rgb_img = pil_img.convert("RGB")
            np_arr = np.array(rgb_img)

            # Convert RGB to BGR for OpenCV compatibility
            cv2_bgr = cv2.cvtColor(np_arr, cv2.COLOR_RGB2BGR)
            return cv2_bgr

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "IMAGE_DECODE_ERROR", "message": f"Malformed or corrupt image: {str(exc)}"},
        )
