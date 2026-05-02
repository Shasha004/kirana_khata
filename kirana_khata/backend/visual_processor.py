"""Visual processing module for Kirana store image analysis.

Provides structured feature extraction from store imagery and an
orchestrator that runs the full visual analysis workflow. Actual CV/ML
models are not wired in yet; the processor operates on pre-extracted
metadata dictionaries so the rest of the pipeline can be developed and
tested independently.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature container
# ---------------------------------------------------------------------------

@dataclass
class VisualFeatures:
    """Immutable container for features extracted from store imagery.

    Attributes:
        shelf_occupancy:  Fraction of shelf space occupied (0.0 – 1.0).
        product_count:    Total number of distinct products detected.
        category_diversity: Number of distinct product categories found.
        store_cleanliness:  Subjective cleanliness score (0.0 – 1.0).
        signage_visible:    Whether branding / signage is visible.
        lighting_quality:   Lighting quality score (0.0 – 1.0).
        raw_detections:     Raw detection payloads for downstream use.
        metadata:           Arbitrary metadata from the image source.
    """

    shelf_occupancy: float = 0.0
    product_count: int = 0
    category_diversity: int = 0
    store_cleanliness: float = 0.0
    signage_visible: bool = False
    lighting_quality: float = 0.0
    raw_detections: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # -- convenience helpers ------------------------------------------------

    def is_valid(self) -> bool:
        """Return True when the feature set passes basic sanity checks."""
        return (
            0.0 <= self.shelf_occupancy <= 1.0
            and self.product_count >= 0
            and self.category_diversity >= 0
        )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the features to a plain dictionary."""
        return {
            "shelf_occupancy": self.shelf_occupancy,
            "product_count": self.product_count,
            "category_diversity": self.category_diversity,
            "store_cleanliness": self.store_cleanliness,
            "signage_visible": self.signage_visible,
            "lighting_quality": self.lighting_quality,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Processor
# ---------------------------------------------------------------------------

class VisualProcessor:
    """Orchestrates the visual analysis workflow.

    Combines image loading, object detection, and shelf analysis into a
    unified processing pipeline for store imagery.

    The processor accepts a *config* dict that may contain:
        - ``shelf_occupancy_weight``  (float) – scoring weight, default 0.35
        - ``product_count_weight``    (float) – scoring weight, default 0.25
        - ``diversity_weight``        (float) – scoring weight, default 0.15
        - ``cleanliness_weight``      (float) – scoring weight, default 0.10
        - ``signage_weight``          (float) – scoring weight, default 0.05
        - ``lighting_weight``         (float) – scoring weight, default 0.10
    """

    # Default scoring weights – must sum to 1.0.
    _DEFAULT_WEIGHTS: Dict[str, float] = {
        "shelf_occupancy": 0.35,
        "product_count": 0.25,
        "category_diversity": 0.15,
        "store_cleanliness": 0.10,
        "signage_visible": 0.05,
        "lighting_quality": 0.10,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the processor with configuration settings.

        Args:
            config: Configuration dictionary for models and weights.
        """
        self.config: Dict[str, Any] = config or {}
        self.weights = self._resolve_weights()
        logger.info("VisualProcessor initialised (weights=%s)", self.weights)

    # -- public API ---------------------------------------------------------

    def process_store_image(self, image_path: str) -> VisualFeatures:
        """Execute full visual analysis on a store image.

        In the current phase this is a **stub** that returns default features.
        Once CV models are integrated, this method will delegate to
        ``ImageLoader``, ``ObjectDetector``, and ``ShelfAnalyzer``.

        Args:
            image_path: Path to the image to be processed.

        Returns:
            A ``VisualFeatures`` instance populated with analysis results.
        """
        logger.info("Processing store image: %s", image_path)

        # Placeholder – will be replaced by real CV pipeline.
        features = VisualFeatures(
            metadata={"source_image": image_path},
        )
        logger.debug("Extracted visual features: %s", features)
        return features

    def compute_visual_score(self, features: VisualFeatures) -> float:
        """Compute a normalised visual health score from extracted features.

        The score is a weighted sum of individual feature components, each
        mapped to a 0.0 – 1.0 range.  This scoring logic is deterministic
        and does not require any ML model.

        Args:
            features: Extracted ``VisualFeatures`` from a store image.

        Returns:
            A float between 0.0 (worst) and 1.0 (best).
        """
        if not features.is_valid():
            logger.warning("Invalid visual features supplied – returning 0.0")
            return 0.0

        w = self.weights

        # Normalise product_count to 0-1 (cap at 200 products).
        norm_product = min(features.product_count / 200.0, 1.0)

        # Normalise category_diversity to 0-1 (cap at 30 categories).
        norm_diversity = min(features.category_diversity / 30.0, 1.0)

        score = (
            w["shelf_occupancy"] * features.shelf_occupancy
            + w["product_count"] * norm_product
            + w["category_diversity"] * norm_diversity
            + w["store_cleanliness"] * features.store_cleanliness
            + w["signage_visible"] * (1.0 if features.signage_visible else 0.0)
            + w["lighting_quality"] * features.lighting_quality
        )

        score = max(0.0, min(score, 1.0))
        logger.info("Visual score computed: %.4f", score)
        return round(score, 4)

    # -- internals ----------------------------------------------------------

    def _resolve_weights(self) -> Dict[str, float]:
        """Merge user-supplied weights with defaults."""
        weights = dict(self._DEFAULT_WEIGHTS)
        for key in weights:
            cfg_key = f"{key}_weight"
            if cfg_key in self.config:
                weights[key] = float(self.config[cfg_key])
        return weights
