"""Fusion module for combining multi-modal underwriting signals.

Merges visual, geographic, and financial data into a single
underwriting profile with a composite credit score and decision.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .visual_processor import VisualFeatures
from .geo_processor import GeoFeatures
from .fraud import FraudFlag

logger = logging.getLogger(__name__)


@dataclass
class UnderwritingProfile:
    """The final fused output of the underwriting engine.

    Attributes:
        store_id:       Unique store identifier.
        visual_score:   Score from visual analysis (0-1).
        geo_score:      Score from geographic analysis (0-1).
        fraud_score:    Fraud risk score (0-1, higher = riskier).
        composite_score: Weighted final score (0-1).
        decision:       APPROVE / REVIEW / REJECT.
        confidence:     Confidence in the decision (0-1).
        fraud_flags:    List of raised fraud flags.
        breakdown:      Per-component score breakdown.
        metadata:       Extra data for audit trail.
    """
    store_id: str = ""
    visual_score: float = 0.0
    geo_score: float = 0.0
    fraud_score: float = 0.0
    composite_score: float = 0.0
    decision: str = "REVIEW"
    confidence: float = 0.0
    fraud_flags: List[FraudFlag] = field(default_factory=list)
    breakdown: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "store_id": self.store_id,
            "visual_score": self.visual_score,
            "geo_score": self.geo_score,
            "fraud_score": self.fraud_score,
            "composite_score": self.composite_score,
            "decision": self.decision,
            "confidence": self.confidence,
            "fraud_flags": [f.to_dict() for f in self.fraud_flags],
            "breakdown": self.breakdown,
            "metadata": self.metadata,
        }


class FusionModel:
    """Combines multi-modal scores into a final underwriting decision.

    Default weights (configurable via *config*):
        - ``visual_weight``  – 0.40
        - ``geo_weight``     – 0.35
        - ``fraud_penalty``  – 0.25

    Decision thresholds:
        - ``approve_threshold`` – 0.65
        - ``reject_threshold``  – 0.35
    """

    _DEFAULT_WEIGHTS: Dict[str, float] = {
        "visual": 0.40,
        "geo": 0.35,
        "fraud_penalty": 0.25,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the fusion model."""
        self.config: Dict[str, Any] = config or {}
        self.weights = self._resolve_weights()
        self._approve = self.config.get("approve_threshold", 0.65)
        self._reject = self.config.get("reject_threshold", 0.35)
        logger.info("FusionModel initialised (weights=%s)", self.weights)

    def fuse(
        self,
        store_id: str,
        visual_score: float,
        geo_score: float,
        fraud_score: float,
        fraud_flags: Optional[List[FraudFlag]] = None,
    ) -> UnderwritingProfile:
        """Merge scores into a single ``UnderwritingProfile``.

        Args:
            store_id:     Unique store identifier.
            visual_score: Visual health score (0-1).
            geo_score:    Geographic viability score (0-1).
            fraud_score:  Fraud risk score (0-1).
            fraud_flags:  List of raised fraud flags.

        Returns:
            A fully populated ``UnderwritingProfile``.
        """
        w = self.weights
        flags = fraud_flags or []

        # Positive signal: weighted average of visual + geo.
        positive = w["visual"] * visual_score + w["geo"] * geo_score
        # Negative signal: fraud penalty.
        penalty = w["fraud_penalty"] * fraud_score

        composite = max(0.0, min(positive - penalty, 1.0))
        composite = round(composite, 4)

        # Hard reject if any CRITICAL fraud flag.
        has_critical = any(
            f.severity.value == "critical" for f in flags
        )

        decision = self._decide(composite, has_critical)
        confidence = self._compute_confidence(
            composite, visual_score, geo_score
        )

        profile = UnderwritingProfile(
            store_id=store_id,
            visual_score=round(visual_score, 4),
            geo_score=round(geo_score, 4),
            fraud_score=round(fraud_score, 4),
            composite_score=composite,
            decision=decision,
            confidence=round(confidence, 4),
            fraud_flags=flags,
            breakdown={
                "visual_contribution": round(w["visual"] * visual_score, 4),
                "geo_contribution": round(w["geo"] * geo_score, 4),
                "fraud_penalty": round(penalty, 4),
            },
        )

        logger.info(
            "Fusion complete for %s: %s (%.4f)",
            store_id, decision, composite,
        )
        return profile

    # -- internals ----------------------------------------------------------

    def _decide(self, composite: float, has_critical: bool) -> str:
        """Map composite score to a decision string."""
        if has_critical:
            return "REJECT"
        if composite >= self._approve:
            return "APPROVE"
        if composite <= self._reject:
            return "REJECT"
        return "REVIEW"

    @staticmethod
    def _compute_confidence(
        composite: float, visual: float, geo: float
    ) -> float:
        """Estimate decision confidence based on score spread."""
        spread = abs(visual - geo)
        # High spread ⇒ conflicting signals ⇒ lower confidence.
        base = min(composite, 1.0 - composite) * 2  # peaks at 0.5
        conf = max(0.0, 1.0 - spread) * (0.5 + 0.5 * base)
        return max(0.0, min(conf, 1.0))

    def _resolve_weights(self) -> Dict[str, float]:
        weights = dict(self._DEFAULT_WEIGHTS)
        for key in weights:
            cfg_key = f"{key}_weight"
            if cfg_key in self.config:
                weights[key] = float(self.config[cfg_key])
        return weights
