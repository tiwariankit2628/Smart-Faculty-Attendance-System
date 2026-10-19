from dataclasses import dataclass
from typing import Optional
import cv2
import numpy as np
from app.config import settings


@dataclass
class ImageQualityResult:
    is_valid: bool
    blur_score: float
    brightness_score: float
    quality_score: float
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class ImageQualityValidator:
    """
    Validates physical image properties before face detection:
    - Minimum resolution / dimension
    - Sharpness / blurriness via Laplacian variance
    - Lighting / illumination exposure (too dark or washed out)
    """

    def validate(self, img_bgr: np.ndarray) -> ImageQualityResult:
        h, w = img_bgr.shape[:2]

        # 1. Dimension validation
        if h < settings.MIN_IMAGE_DIMENSION or w < settings.MIN_IMAGE_DIMENSION:
            return ImageQualityResult(
                is_valid=False,
                blur_score=0.0,
                brightness_score=0.0,
                quality_score=0.0,
                error_code="LOW_IMAGE_RESOLUTION",
                error_message="Face image is not clear enough. Please improve lighting and try again.",
            )

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        # 2. Sharpness / Blur Detection via Laplacian Variance
        # Measure both full frame and central portrait region (prevents dilution when sitting against flat plain walls)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        ch0, ch1 = int(0.15 * h), int(0.85 * h)
        cw0, cw1 = int(0.15 * w), int(0.85 * w)
        center_roi = gray[ch0:ch1, cw0:cw1] if (ch1 > ch0 and cw1 > cw0) else gray
        center_laplacian_var = cv2.Laplacian(center_roi, cv2.CV_64F).var() if center_roi.size > 0 else laplacian_var

        effective_sharpness = max(laplacian_var, center_laplacian_var)
        if effective_sharpness < settings.BLUR_THRESHOLD:
            return ImageQualityResult(
                is_valid=False,
                blur_score=round(float(effective_sharpness), 2),
                brightness_score=round(float(np.mean(gray)), 2),
                quality_score=0.2,
                error_code="IMAGE_TOO_BLURRY",
                error_message="Face image is not clear enough. Please improve lighting and try again.",
            )

        # 3. Illumination / Brightness Detection
        mean_brightness = float(np.mean(gray))
        if mean_brightness < settings.MIN_BRIGHTNESS:
            return ImageQualityResult(
                is_valid=False,
                blur_score=round(float(laplacian_var), 2),
                brightness_score=round(mean_brightness, 2),
                quality_score=0.3,
                error_code="IMAGE_TOO_DARK",
                error_message="Face image is not clear enough. Please improve lighting and try again.",
            )

        if mean_brightness > settings.MAX_BRIGHTNESS:
            return ImageQualityResult(
                is_valid=False,
                blur_score=round(float(laplacian_var), 2),
                brightness_score=round(mean_brightness, 2),
                quality_score=0.3,
                error_code="IMAGE_OVEREXPOSED",
                error_message="Face image is not clear enough. Please improve lighting and try again.",
            )

        # Calculate a normalized quality score between 0.0 and 1.0
        # Normalizing blur score (e.g. 65 to 300+)
        norm_blur = min(1.0, max(0.0, (laplacian_var - settings.BLUR_THRESHOLD) / 200.0))
        # Optimal brightness center around 128
        norm_brightness = 1.0 - (abs(mean_brightness - 128.0) / 128.0)
        overall_quality = round(0.5 * norm_blur + 0.5 * norm_brightness, 2)

        return ImageQualityResult(
            is_valid=True,
            blur_score=round(float(laplacian_var), 2),
            brightness_score=round(mean_brightness, 2),
            quality_score=max(0.5, overall_quality),
        )


image_quality_validator = ImageQualityValidator()
