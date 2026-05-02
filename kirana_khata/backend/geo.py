"""Geographic feature extraction module for Kirana store underwriting.

Provides ``GeoLocation`` for coordinate validation and
``GeoFeatureExtractor`` which computes ring-based population estimates,
POI counts, road classification, and competition counts for a given
lat/lon.  External API integration points are stubbed — the extractor
ships with a deterministic mock data provider so the full pipeline can
run end-to-end without network access.
"""

from __future__ import annotations

import hashlib
import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# GeoLocation
# ---------------------------------------------------------------------------

class GeoLocation:
    """Represents and validates geographic coordinates.

    Handles GPS data, store addresses, and proximity calculations.
    """

    def __init__(self, latitude: float, longitude: float):
        """Initialize with latitude and longitude.

        Args:
            latitude:  Geographic latitude  (−90 to +90).
            longitude: Geographic longitude (−180 to +180).

        Raises:
            ValueError: If coordinates are out of range.
        """
        if not (-90.0 <= latitude <= 90.0):
            raise ValueError(
                f"Latitude must be in [-90, 90], got {latitude}"
            )
        if not (-180.0 <= longitude <= 180.0):
            raise ValueError(
                f"Longitude must be in [-180, 180], got {longitude}"
            )
        self.latitude = latitude
        self.longitude = longitude

    def get_coordinates(self) -> Tuple[float, float]:
        """Return the current coordinates.

        Returns:
            A tuple of (latitude, longitude).
        """
        return (self.latitude, self.longitude)

    def __repr__(self) -> str:
        return f"GeoLocation(lat={self.latitude:.6f}, lon={self.longitude:.6f})"


# ---------------------------------------------------------------------------
# Population ring container
# ---------------------------------------------------------------------------

@dataclass
class PopulationRings:
    """Estimated population counts in concentric rings around the store.

    Attributes:
        pop_0_200m:    People within 0 – 200 m radius.
        pop_200_500m:  People within 200 – 500 m radius.
        pop_500_1000m: People within 500 – 1 000 m radius.
        total:         Sum of all rings.
    """

    pop_0_200m: int = 0
    pop_200_500m: int = 0
    pop_500_1000m: int = 0

    @property
    def total(self) -> int:
        return self.pop_0_200m + self.pop_200_500m + self.pop_500_1000m

    def to_dict(self) -> Dict[str, int]:
        return {
            "pop_0_200m": self.pop_0_200m,
            "pop_200_500m": self.pop_200_500m,
            "pop_500_1000m": self.pop_500_1000m,
            "total": self.total,
        }


# ---------------------------------------------------------------------------
# POI summary
# ---------------------------------------------------------------------------

@dataclass
class POICounts:
    """Counts of nearby points of interest by category.

    Attributes:
        schools:       Schools / colleges within 1 km.
        hospitals:     Hospitals / clinics within 1 km.
        bus_stops:     Bus stops / transit stations within 500 m.
        temples:       Religious places within 500 m.
        markets:       Markets / mandis within 1 km.
        banks:         Banks / ATMs within 500 m.
    """

    schools: int = 0
    hospitals: int = 0
    bus_stops: int = 0
    temples: int = 0
    markets: int = 0
    banks: int = 0

    def to_dict(self) -> Dict[str, int]:
        return {
            "schools": self.schools,
            "hospitals": self.hospitals,
            "bus_stops": self.bus_stops,
            "temples": self.temples,
            "markets": self.markets,
            "banks": self.banks,
        }


# ---------------------------------------------------------------------------
# Competition summary
# ---------------------------------------------------------------------------

@dataclass
class CompetitionInfo:
    """Competition landscape around the store.

    Attributes:
        kirana_count_500m:   Kirana / general stores within 500 m.
        kirana_count_1km:    Kirana / general stores within 1 km.
        supermarket_count:   Supermarkets / chains within 2 km.
        nearest_competitor_m: Distance to the nearest competitor (metres).
    """

    kirana_count_500m: int = 0
    kirana_count_1km: int = 0
    supermarket_count: int = 0
    nearest_competitor_m: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kirana_count_500m": self.kirana_count_500m,
            "kirana_count_1km": self.kirana_count_1km,
            "supermarket_count": self.supermarket_count,
            "nearest_competitor_m": round(self.nearest_competitor_m, 1),
        }


# ---------------------------------------------------------------------------
# Full extraction result
# ---------------------------------------------------------------------------

ROAD_TYPES = ("highway", "arterial", "collector", "local", "residential")

@dataclass
class GeoExtractionResult:
    """Complete result of geographic feature extraction.

    This is the raw, detailed output.  ``GeoFeatureExtractor`` also
    provides a helper to convert this into the simpler ``GeoFeatures``
    used by ``GeoProcessor``.

    Attributes:
        location:     The validated ``GeoLocation``.
        population:   Ring-based population estimates.
        poi:          Nearby POI counts.
        road_type:    Road classification for the store's street.
        competition:  Competition landscape.
        metadata:     Extra data for audit trail.
    """

    location: GeoLocation = None  # type: ignore[assignment]
    population: PopulationRings = field(default_factory=PopulationRings)
    poi: POICounts = field(default_factory=POICounts)
    road_type: str = "local"
    competition: CompetitionInfo = field(default_factory=CompetitionInfo)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latitude": self.location.latitude if self.location else None,
            "longitude": self.location.longitude if self.location else None,
            "population": self.population.to_dict(),
            "poi": self.poi.to_dict(),
            "road_type": self.road_type,
            "competition": self.competition.to_dict(),
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# GeoFeatureExtractor
# ---------------------------------------------------------------------------

class GeoFeatureExtractor:
    """Extracts geographic features for a store location.

    Usage::

        extractor = GeoFeatureExtractor()
        result    = extractor.extract(19.076, 72.877)
        print(result.population.pop_0_200m)
        print(result.road_type)

        # Convert to the lightweight GeoFeatures used by GeoProcessor:
        from kirana_khata.geo_processor import GeoFeatures
        features = extractor.to_geo_features(result)

    The default implementation uses a **deterministic mock data
    provider** seeded by the coordinate hash.  Override
    ``_fetch_population``, ``_fetch_poi``, ``_fetch_road_type``, and
    ``_fetch_competition`` to wire in real APIs (e.g. Google Places,
    WorldPop, OSM Overpass).

    Config overrides (via *config* dict):
        - ``use_mock``  (bool) – force mock mode, default ``True``
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the extractor.

        Args:
            config: Optional parameter overrides.
        """
        cfg = config or {}
        self._use_mock: bool = cfg.get("use_mock", True)
        logger.info(
            "GeoFeatureExtractor initialised (mock=%s)", self._use_mock
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract(self, latitude: float, longitude: float) -> GeoExtractionResult:
        """Run full geographic feature extraction.

        Args:
            latitude:  Store latitude.
            longitude: Store longitude.

        Returns:
            A fully populated ``GeoExtractionResult``.
        """
        location = GeoLocation(latitude, longitude)
        seed = self._coord_seed(latitude, longitude)

        population = self._fetch_population(latitude, longitude, seed)
        poi = self._fetch_poi(latitude, longitude, seed)
        road_type = self._fetch_road_type(latitude, longitude, seed)
        competition = self._fetch_competition(latitude, longitude, seed)

        result = GeoExtractionResult(
            location=location,
            population=population,
            poi=poi,
            road_type=road_type,
            competition=competition,
            metadata={"source": "mock" if self._use_mock else "api"},
        )

        logger.info(
            "Geo extraction for (%.4f, %.4f): pop_total=%d, road=%s, "
            "kirana_500m=%d",
            latitude, longitude,
            population.total, road_type,
            competition.kirana_count_500m,
        )
        return result

    def to_geo_features(self, result: GeoExtractionResult):
        """Convert a ``GeoExtractionResult`` to a ``GeoFeatures`` instance.

        This is a convenience bridge to the ``geo_processor`` module so
        that extraction results can feed directly into ``GeoProcessor``.

        Returns:
            A ``GeoFeatures`` dataclass (imported from ``geo_processor``).
        """
        # Late import to avoid circular dependency.
        from .geo_processor import GeoFeatures

        pop = result.population
        comp = result.competition
        total_pop = pop.total

        # Derive population density (people / km²) from ring data.
        # Area of 1 km circle ≈ π km².
        area_km2 = math.pi * (1.0 ** 2)
        pop_density = total_pop / area_km2 if area_km2 > 0 else 0.0

        # Footfall index: heuristic from POI mix + population.
        poi = result.poi
        poi_total = (
            poi.schools + poi.hospitals + poi.bus_stops
            + poi.temples + poi.markets + poi.banks
        )
        footfall_raw = (
            0.4 * min(total_pop / 5000.0, 1.0)
            + 0.3 * min(poi_total / 15.0, 1.0)
            + 0.3 * (1.0 if result.road_type in ("arterial", "collector") else
                      0.7 if result.road_type == "highway" else 0.4)
        )
        footfall_index = max(0.0, min(footfall_raw, 1.0))

        # Market saturation: heuristic from competition density.
        sat_raw = min(
            (comp.kirana_count_1km + comp.supermarket_count * 3) / 25.0,
            1.0,
        )

        # Region tier: rough heuristic from population density.
        if pop_density > 10_000:
            tier = 1
        elif pop_density > 4_000:
            tier = 2
        else:
            tier = 3

        return GeoFeatures(
            latitude=result.location.latitude,
            longitude=result.location.longitude,
            population_density=round(pop_density, 1),
            competitor_count=comp.kirana_count_1km + comp.supermarket_count,
            nearest_competitor_km=round(comp.nearest_competitor_m / 1000.0, 3),
            footfall_index=round(footfall_index, 4),
            market_saturation=round(sat_raw, 4),
            region_tier=tier,
            metadata={
                "population_rings": pop.to_dict(),
                "poi": poi.to_dict(),
                "road_type": result.road_type,
                "competition": comp.to_dict(),
            },
        )

    # ------------------------------------------------------------------
    # Data providers (override for real APIs)
    # ------------------------------------------------------------------

    def _fetch_population(
        self, lat: float, lon: float, seed: int
    ) -> PopulationRings:
        """Fetch ring-based population estimates.

        Default: deterministic mock derived from coordinate seed.
        """
        base = 200 + (seed % 800)
        return PopulationRings(
            pop_0_200m=base,
            pop_200_500m=int(base * 2.5 + (seed % 300)),
            pop_500_1000m=int(base * 5.0 + (seed % 600)),
        )

    def _fetch_poi(
        self, lat: float, lon: float, seed: int
    ) -> POICounts:
        """Fetch nearby POI counts.

        Default: deterministic mock derived from coordinate seed.
        """
        return POICounts(
            schools=(seed % 5) + 1,
            hospitals=(seed % 3) + 1,
            bus_stops=(seed % 6) + 2,
            temples=(seed % 4) + 1,
            markets=(seed % 3) + 1,
            banks=(seed % 5) + 2,
        )

    def _fetch_road_type(
        self, lat: float, lon: float, seed: int
    ) -> str:
        """Classify the road nearest to the store.

        Default: deterministic mock derived from coordinate seed.
        """
        return ROAD_TYPES[seed % len(ROAD_TYPES)]

    def _fetch_competition(
        self, lat: float, lon: float, seed: int
    ) -> CompetitionInfo:
        """Fetch competition landscape.

        Default: deterministic mock derived from coordinate seed.
        """
        k500 = (seed % 8) + 1
        return CompetitionInfo(
            kirana_count_500m=k500,
            kirana_count_1km=k500 + (seed % 6) + 2,
            supermarket_count=(seed % 3),
            nearest_competitor_m=float(50 + (seed % 400)),
        )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _coord_seed(lat: float, lon: float) -> int:
        """Generate a deterministic integer seed from coordinates.

        Ensures the same location always produces the same mock data,
        making tests reproducible.
        """
        key = f"{lat:.6f},{lon:.6f}"
        digest = hashlib.md5(key.encode()).hexdigest()
        return int(digest[:8], 16)
