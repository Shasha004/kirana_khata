"""Inventory estimation module for Kirana store underwriting.

Maps YOLO detections to business categories (staples, FMCG, high-margin),
estimates total inventory value in INR, computes category ratios, and
derives the fast-moving fraction.  All mapping tables and unit prices are
configurable so the estimator can be tuned per region or product mix.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from .detector import Detection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Default category → class-name mapping
# ---------------------------------------------------------------------------
# Maps each business category to the set of YOLO/COCO class names that
# belong to it.  These are intentionally broad; a production deployment
# should train a custom model with store-specific labels.

DEFAULT_CATEGORY_MAP: Dict[str, Set[str]] = {
    "staples": {
        "bowl", "cup", "spoon", "knife", "fork",
        "banana", "apple", "orange", "broccoli", "carrot",
        "rice", "flour", "sugar", "salt", "dal",
    },
    "fmcg": {
        "bottle", "cup", "toothbrush",
        "soap", "shampoo", "detergent", "biscuit",
        "chips", "noodles", "drink",
    },
    "high_margin": {
        "wine glass", "cake", "cell phone",
        "laptop", "remote", "scissors", "clock",
        "chocolate", "cosmetic", "perfume",
    },
}

# Average unit value (INR) per category – rough proxy for estimation.
DEFAULT_UNIT_VALUES: Dict[str, float] = {
    "staples": 45.0,
    "fmcg": 120.0,
    "high_margin": 350.0,
    "uncategorised": 80.0,
}

# Classes considered "fast-moving" (high turnover).
DEFAULT_FAST_MOVING: Set[str] = {
    "bottle", "banana", "apple", "cup", "bowl",
    "soap", "biscuit", "chips", "noodles", "drink",
    "toothbrush", "detergent", "shampoo",
}


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class InventoryEstimate:
    """Container for inventory estimation results.

    Attributes:
        total_items:          Total detected items mapped to inventory.
        inventory_value_inr:  Estimated total inventory value in INR.
        category_counts:      Number of items per category.
        category_ratios:      Fraction of total items per category (0-1).
        fast_moving_fraction: Fraction of items that are fast-moving.
        per_detection:        Category assignment for each detection.
        diagnostics:          Extra metadata for audit.
    """

    total_items: int = 0
    inventory_value_inr: float = 0.0
    category_counts: Dict[str, int] = field(default_factory=dict)
    category_ratios: Dict[str, float] = field(default_factory=dict)
    fast_moving_fraction: float = 0.0
    per_detection: List[Dict[str, Any]] = field(default_factory=list)
    diagnostics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a plain dictionary."""
        return {
            "total_items": self.total_items,
            "inventory_value_inr": round(self.inventory_value_inr, 2),
            "category_counts": self.category_counts,
            "category_ratios": {
                k: round(v, 4) for k, v in self.category_ratios.items()
            },
            "fast_moving_fraction": round(self.fast_moving_fraction, 4),
        }


# ---------------------------------------------------------------------------
# InventoryEstimator
# ---------------------------------------------------------------------------

class InventoryEstimator:
    """Estimates store inventory composition and value from detections.

    Usage::

        estimator = InventoryEstimator()
        estimate  = estimator.estimate(detections)
        print(estimate.inventory_value_inr)
        print(estimate.category_ratios)

    Config overrides (via *config* dict):
        - ``category_map``    (dict)  – category → set of class names
        - ``unit_values``     (dict)  – category → avg INR unit value
        - ``fast_moving``     (set)   – class names considered fast-moving
        - ``min_confidence``  (float) – ignore detections below this, default 0.3
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the estimator.

        Args:
            config: Optional overrides for mappings and thresholds.
        """
        cfg = config or {}

        self._category_map: Dict[str, Set[str]] = cfg.get(
            "category_map", DEFAULT_CATEGORY_MAP
        )
        self._unit_values: Dict[str, float] = cfg.get(
            "unit_values", DEFAULT_UNIT_VALUES
        )
        self._fast_moving: Set[str] = cfg.get(
            "fast_moving", DEFAULT_FAST_MOVING
        )
        self._min_conf: float = float(cfg.get("min_confidence", 0.3))

        # Build a reverse lookup: class_name → category.
        self._class_to_cat: Dict[str, str] = self._build_reverse_map()

        logger.info(
            "InventoryEstimator initialised – %d categories, "
            "%d mapped classes, min_conf=%.2f",
            len(self._category_map),
            len(self._class_to_cat),
            self._min_conf,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def estimate(self, detections: List[Detection]) -> InventoryEstimate:
        """Build an inventory estimate from a list of detections.

        Args:
            detections: Output of ``YOLODetector.detect()``.

        Returns:
            A populated ``InventoryEstimate``.
        """
        # Filter by confidence.
        valid = [d for d in detections if d.confidence >= self._min_conf]
        logger.debug(
            "Detections: %d total, %d above conf=%.2f",
            len(detections), len(valid), self._min_conf,
        )

        # Initialise category counts.
        all_cats = list(self._category_map.keys()) + ["uncategorised"]
        counts: Dict[str, int] = {cat: 0 for cat in all_cats}

        per_det: List[Dict[str, Any]] = []
        fast_count = 0

        for det in valid:
            cat = self._classify(det.class_name)
            counts[cat] = counts.get(cat, 0) + 1

            if det.class_name.lower() in self._fast_moving:
                fast_count += 1

            per_det.append({
                "class_name": det.class_name,
                "category": cat,
                "confidence": round(det.confidence, 4),
                "unit_value_inr": self._unit_values.get(
                    cat, self._unit_values.get("uncategorised", 0.0)
                ),
            })

        total = len(valid)

        # Category ratios.
        ratios = self._compute_ratios(counts, total)

        # Inventory value.
        value = self._compute_value(counts)

        # Fast-moving fraction.
        fm_frac = fast_count / total if total > 0 else 0.0

        estimate = InventoryEstimate(
            total_items=total,
            inventory_value_inr=value,
            category_counts=counts,
            category_ratios=ratios,
            fast_moving_fraction=fm_frac,
            per_detection=per_det,
            diagnostics={
                "raw_detection_count": len(detections),
                "filtered_count": total,
                "fast_moving_count": fast_count,
            },
        )

        logger.info(
            "Inventory estimate: %d items, ₹%.0f, ratios=%s, fast=%.2f",
            total, value,
            {k: round(v, 2) for k, v in ratios.items()},
            fm_frac,
        )
        return estimate

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _classify(self, class_name: str) -> str:
        """Map a detection class name to a business category."""
        return self._class_to_cat.get(class_name.lower(), "uncategorised")

    def _compute_ratios(
        self, counts: Dict[str, int], total: int
    ) -> Dict[str, float]:
        """Compute per-category fractions of total items."""
        if total == 0:
            return {cat: 0.0 for cat in counts}
        return {cat: cnt / total for cat, cnt in counts.items()}

    def _compute_value(self, counts: Dict[str, int]) -> float:
        """Estimate total inventory value from counts × unit values."""
        total_val = 0.0
        for cat, cnt in counts.items():
            uv = self._unit_values.get(
                cat, self._unit_values.get("uncategorised", 0.0)
            )
            total_val += cnt * uv
        return total_val

    def _build_reverse_map(self) -> Dict[str, str]:
        """Invert ``category_map`` to a class_name → category lookup."""
        reverse: Dict[str, str] = {}
        for cat, class_names in self._category_map.items():
            for cn in class_names:
                reverse[cn.lower()] = cat
        return reverse
