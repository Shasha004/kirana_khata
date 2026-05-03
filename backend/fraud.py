"""Fraud detection module for Kirana store underwriting."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .visual_processor import VisualFeatures
from .geo_processor import GeoFeatures

logger = logging.getLogger(__name__)


class Severity(Enum):
    """Severity levels for fraud flags."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class FraudFlag:
    """A single fraud indicator raised by a detection rule."""
    rule_id: str
    severity: Severity
    description: str
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "severity": self.severity.value,
            "description": self.description,
            "evidence": self.evidence,
        }


class FraudDetector:
    """Identifies potential fraudulent patterns in store data.

    Uses rule-based cross-checks between visual, geographic, and
    financial signals.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the fraud detector."""
        self.config: Dict[str, Any] = config or {}
        self._min_shelf_occ = self.config.get("min_shelf_occupancy", 0.10)
        self._max_competitors = self.config.get("max_competitor_ratio", 15)
        self._min_products = int(self.config.get("min_product_count", 5))
        logger.info("FraudDetector initialised")

    def check_for_anomalies(
        self,
        visual_features: VisualFeatures,
        geo_features: GeoFeatures,
        financial_data: Optional[Dict[str, Any]] = None,
    ) -> List[FraudFlag]:
        """Run all fraud-detection rules and return raised flags."""
        flags: List[FraudFlag] = []
        fin = financial_data or {}

        flags.extend(self._check_visual(visual_features))
        flags.extend(self._check_geo(geo_features))
        flags.extend(self._check_cross(visual_features, geo_features, fin))

        logger.info("Fraud check – %d flag(s) raised", len(flags))
        return flags

    def compute_fraud_score(self, flags: List[FraudFlag]) -> float:
        """Derive a normalised fraud-risk score (0 = clean, 1 = high risk)."""
        sev_w = {Severity.LOW: 0.15, Severity.MEDIUM: 0.4,
                 Severity.HIGH: 0.7, Severity.CRITICAL: 1.0}
        raw = sum(sev_w.get(f.severity, 0.0) for f in flags)
        score = min(raw / 2.0, 1.0)
        logger.info("Fraud risk score: %.4f (%d flags)", score, len(flags))
        return round(score, 4)

    # -- rules --------------------------------------------------------------

    def _check_visual(self, vf: VisualFeatures) -> List[FraudFlag]:
        flags: List[FraudFlag] = []
        if vf.shelf_occupancy < self._min_shelf_occ:
            flags.append(FraudFlag(
                "VISUAL_SHELF_EMPTY", Severity.HIGH,
                "Shelf occupancy is suspiciously low.",
                {"shelf_occupancy": vf.shelf_occupancy},
            ))
        if vf.product_count < self._min_products:
            flags.append(FraudFlag(
                "VISUAL_LOW_PRODUCTS", Severity.MEDIUM,
                "Very few products detected.",
                {"product_count": vf.product_count},
            ))
        if vf.lighting_quality < 0.15:
            flags.append(FraudFlag(
                "VISUAL_POOR_LIGHTING", Severity.LOW,
                "Extremely poor lighting may indicate a non-functional store.",
                {"lighting_quality": vf.lighting_quality},
            ))
        return flags

    def _check_geo(self, gf: GeoFeatures) -> List[FraudFlag]:
        flags: List[FraudFlag] = []
        if gf.competitor_count > self._max_competitors:
            flags.append(FraudFlag(
                "GEO_OVERSATURATED", Severity.MEDIUM,
                "Extremely high competitor density.",
                {"competitor_count": gf.competitor_count},
            ))
        if gf.market_saturation > 0.90:
            flags.append(FraudFlag(
                "GEO_MARKET_SATURATED", Severity.HIGH,
                "Market is near-fully saturated.",
                {"market_saturation": gf.market_saturation},
            ))
        return flags

    def _check_cross(self, vf: VisualFeatures, gf: GeoFeatures,
                     fin: Dict[str, Any]) -> List[FraudFlag]:
        flags: List[FraudFlag] = []
        
        claimed = fin.get("claimed_tier")
        if claimed is not None and claimed < gf.region_tier:
            flags.append(FraudFlag(
                "CROSS_TIER_MISMATCH", Severity.MEDIUM,
                "Claimed region tier does not match geo-derived tier.",
                {"claimed_tier": claimed, "actual_tier": gf.region_tier},
            ))
        return flags
