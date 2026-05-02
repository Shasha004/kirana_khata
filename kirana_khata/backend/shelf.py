"""Shelf density analysis module for Kirana store underwriting.

Computes the **Shelf Density Index (SDI)** family of metrics from store
shelf images using low-level CV heuristics (no trained ML model needed):

- **SDI_raw**         – overall shelf occupancy via HSV saturation masking.
- **Zone SDI**        – per-zone (top / eye-level / bottom) occupancy.
- **SDI_uniformity**  – consistency of stocking across wall segments.
- **SDI_depth**       – perceived shelf depth via Laplacian focus variance.

All scores are normalised to **0.0 – 1.0** (higher = better stocked).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants / defaults
# ---------------------------------------------------------------------------

# HSV saturation thresholds for "product-present" mask.
DEFAULT_SAT_LOW: int = 40
DEFAULT_SAT_HIGH: int = 255

# Vertical zone splits (fractions of image height).
ZONE_SPLITS: Dict[str, Tuple[float, float]] = {
    "top": (0.00, 0.33),
    "eye": (0.33, 0.66),
    "bottom": (0.66, 1.00),
}

# Number of equal-width wall segments for uniformity analysis.
DEFAULT_WALL_SEGMENTS: int = 5

# Laplacian depth: reference variance for a "fully sharp" shelf.
DEFAULT_DEPTH_REF_VAR: float = 500.0


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class ShelfMetrics:
    """Container for all shelf-density metrics.

    Attributes:
        sdi_raw:           Overall shelf occupancy ratio (0-1).
        zone_sdi:          Per-zone occupancy – keys ``top``, ``eye``,
                           ``bottom``.
        sdi_uniformity:    Stocking consistency across wall segments (0-1,
                           1 = perfectly uniform).
        sdi_depth:         Perceived depth / focus score (0-1).
        wall_segment_sdis: Raw per-segment SDI values used to derive
                           uniformity.
        diagnostics:       Extra debug information.
    """

    sdi_raw: float = 0.0
    zone_sdi: Dict[str, float] = field(default_factory=dict)
    sdi_uniformity: float = 0.0
    sdi_depth: float = 0.0
    wall_segment_sdis: List[float] = field(default_factory=list)
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a plain dictionary."""
        return {
            "sdi_raw": round(self.sdi_raw, 4),
            "zone_sdi": {k: round(v, 4) for k, v in self.zone_sdi.items()},
            "sdi_uniformity": round(self.sdi_uniformity, 4),
            "sdi_depth": round(self.sdi_depth, 4),
            "wall_segment_sdis": [round(v, 4) for v in self.wall_segment_sdis],
        }


# ---------------------------------------------------------------------------
# ShelfAnalyzer
# ---------------------------------------------------------------------------

class ShelfAnalyzer:
    """Analyses store shelf images to produce SDI metrics.

    Usage::

        analyzer = ShelfAnalyzer()
        metrics  = analyzer.analyze(shelf_bgr_image)
        print(metrics.sdi_raw, metrics.zone_sdi, metrics.sdi_uniformity)

    Config overrides (via *config* dict):
        - ``sat_low``          (int)   – HSV saturation lower bound, default 40
        - ``sat_high``         (int)   – HSV saturation upper bound, default 255
        - ``wall_segments``    (int)   – number of horizontal segments, default 5
        - ``depth_ref_var``    (float) – Laplacian reference variance, default 500
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the shelf analyzer.

        Args:
            config: Optional parameter overrides.
        """
        cfg = config or {}
        self._sat_low: int = int(cfg.get("sat_low", DEFAULT_SAT_LOW))
        self._sat_high: int = int(cfg.get("sat_high", DEFAULT_SAT_HIGH))
        self._wall_segs: int = int(cfg.get("wall_segments", DEFAULT_WALL_SEGMENTS))
        self._depth_ref: float = float(cfg.get("depth_ref_var", DEFAULT_DEPTH_REF_VAR))
        logger.info(
            "ShelfAnalyzer initialised (sat=%d-%d, segs=%d, depth_ref=%.0f)",
            self._sat_low, self._sat_high, self._wall_segs, self._depth_ref,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, image: np.ndarray) -> ShelfMetrics:
        """Run the full shelf-density analysis on a single image.

        Args:
            image: BGR numpy array of a shelf photograph.

        Returns:
            A populated ``ShelfMetrics`` instance.

        Raises:
            ValueError: If the image is invalid.
        """
        self._validate(image)
        h, w = image.shape[:2]

        # 1. Build the saturation mask.
        sat_mask = self._build_saturation_mask(image)

        # 2. SDI_raw – overall occupancy.
        sdi_raw = self._compute_mask_ratio(sat_mask)

        # 3. Zone SDI – per vertical zone.
        zone_sdi = self._compute_zone_sdi(sat_mask, h)

        # 4. Wall-segment SDIs + uniformity.
        seg_sdis = self._compute_segment_sdis(sat_mask, w)
        sdi_uniformity = self._compute_uniformity(seg_sdis)

        # 5. SDI_depth via Laplacian variance.
        sdi_depth = self._compute_depth(image)

        metrics = ShelfMetrics(
            sdi_raw=sdi_raw,
            zone_sdi=zone_sdi,
            sdi_uniformity=sdi_uniformity,
            sdi_depth=sdi_depth,
            wall_segment_sdis=seg_sdis,
            diagnostics={
                "image_shape": (h, w),
                "sat_range": (self._sat_low, self._sat_high),
                "wall_segments": self._wall_segs,
            },
        )

        logger.info(
            "Shelf analysis complete – SDI_raw=%.3f, uniformity=%.3f, "
            "depth=%.3f, zones=%s",
            sdi_raw, sdi_uniformity, sdi_depth,
            {k: round(v, 3) for k, v in zone_sdi.items()},
        )
        return metrics

    # ------------------------------------------------------------------
    # Step 1 – Saturation mask
    # ------------------------------------------------------------------

    def _build_saturation_mask(self, image: np.ndarray) -> np.ndarray:
        """Create a binary mask where saturated (colourful) pixels = product.

        Products on shelves tend to have higher colour saturation than
        bare wall / empty shelf backgrounds.

        Returns:
            A single-channel ``uint8`` mask (255 = product, 0 = empty).
        """
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        s_channel = hsv[:, :, 1]

        _, mask = cv2.threshold(
            s_channel, self._sat_low, 255, cv2.THRESH_BINARY
        )

        # Light morphological close to fill small gaps in product regions.
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        return mask

    # ------------------------------------------------------------------
    # Step 2 – SDI_raw
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_mask_ratio(mask: np.ndarray) -> float:
        """Return the fraction of non-zero pixels in a binary mask."""
        total = mask.size
        if total == 0:
            return 0.0
        return float(np.count_nonzero(mask)) / total

    # ------------------------------------------------------------------
    # Step 3 – Zone SDI
    # ------------------------------------------------------------------

    def _compute_zone_sdi(
        self, mask: np.ndarray, img_height: int
    ) -> Dict[str, float]:
        """Compute SDI for each vertical zone (top / eye / bottom).

        Args:
            mask:       Full-image binary saturation mask.
            img_height: Height of the image in pixels.

        Returns:
            Dict mapping zone name → SDI ratio.
        """
        zone_sdi: Dict[str, float] = {}
        for zone_name, (frac_start, frac_end) in ZONE_SPLITS.items():
            y_start = int(img_height * frac_start)
            y_end = int(img_height * frac_end)
            zone_strip = mask[y_start:y_end, :]
            zone_sdi[zone_name] = self._compute_mask_ratio(zone_strip)
        return zone_sdi

    # ------------------------------------------------------------------
    # Step 4 – Wall-segment SDIs + uniformity
    # ------------------------------------------------------------------

    def _compute_segment_sdis(
        self, mask: np.ndarray, img_width: int
    ) -> List[float]:
        """Split the mask into equal-width vertical segments and compute
        the SDI for each.

        Returns:
            A list of per-segment SDI values.
        """
        seg_w = max(img_width // self._wall_segs, 1)
        sdis: List[float] = []

        for i in range(self._wall_segs):
            x_start = i * seg_w
            x_end = (
                (i + 1) * seg_w if i < self._wall_segs - 1 else img_width
            )
            segment = mask[:, x_start:x_end]
            sdis.append(self._compute_mask_ratio(segment))

        return sdis

    @staticmethod
    def _compute_uniformity(segment_sdis: List[float]) -> float:
        """Derive a uniformity score from per-segment SDI values.

        Uniformity = 1 − normalised standard deviation.  A perfectly
        uniform shelf scores 1.0; high variance scores near 0.0.

        Args:
            segment_sdis: List of per-segment SDI ratios.

        Returns:
            Float between 0.0 and 1.0.
        """
        if len(segment_sdis) < 2:
            return 1.0

        arr = np.array(segment_sdis, dtype=np.float64)
        mean = float(np.mean(arr))
        if mean == 0.0:
            # All segments empty → technically "uniform" but meaningless.
            return 0.0

        # Coefficient of variation, capped at 1.0.
        cv = float(np.std(arr)) / mean
        uniformity = max(0.0, 1.0 - cv)
        return uniformity

    # ------------------------------------------------------------------
    # Step 5 – SDI_depth (Laplacian variance)
    # ------------------------------------------------------------------

    def _compute_depth(self, image: np.ndarray) -> float:
        """Estimate perceived shelf depth using Laplacian focus variance.

        A well-stocked, deep shelf produces more high-frequency detail
        (textures of products at various depths) and therefore a higher
        Laplacian variance.

        Returns:
            Normalised depth score (0-1).
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var = float(np.var(laplacian))

        # Normalise against reference variance.
        depth = min(lap_var / self._depth_ref, 1.0)
        logger.debug("Laplacian variance=%.2f → depth=%.4f", lap_var, depth)
        return depth

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate(image: np.ndarray) -> None:
        """Ensure the image is a valid 3-channel BGR array."""
        if image is None:
            raise ValueError("Image is None")
        if not isinstance(image, np.ndarray):
            raise ValueError(
                f"Expected numpy.ndarray, got {type(image).__name__}"
            )
        if image.ndim != 3 or image.shape[2] != 3:
            raise ValueError(
                f"Expected 3-channel image (H, W, 3), got shape {image.shape}"
            )
        if image.size == 0:
            raise ValueError("Image array is empty")
