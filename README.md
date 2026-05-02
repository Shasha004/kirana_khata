# Kirana Underwriting System

> Remote cash-flow underwriting for India's kirana stores — using shop images + GPS, no transaction data required.

---

## What This Is

Banks and NBFCs want to give loans to small kirana (grocery) store owners, but these shops have no bank statements, no GST records, and no formal bookkeeping. A field officer visiting every shop is slow, expensive, and gameable.

This system solves that. A loan officer uploads **5 photos of the shop** and drops a **GPS pin**. The system runs a full computer-vision + geo pipeline and outputs a calibrated daily/monthly cash flow estimate, a confidence score, fraud risk flags, and a loan sizing recommendation — fully automated, in seconds.

---

## Architecture

```
5 shop images (Front, Billing Area, Left Wall, Centre Wall, Right Wall) + GPS lat/lng
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│                    app.py  (FastAPI)                       │
│  POST /underwrite — receives multipart/form-data           │
│  • Saves images to temp dir                                │
│  • Calls KiranaPipeline.run()                              │
│  • Returns merged JSON response                            │
└────────────────┬───────────────────────────────────────────┘                                                           
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│              backend/pipeline.py                           │
│                                                            │
│  KiranaPipeline                                            │
│  ├── KiranaUnderwriter.run()  (9-step core pipeline)       │
│  │     1. ImageLoader       — load & preprocess 5 images   │
│  │     2. YOLODetector      — object detection (YOLOv8n)   │
│  │     3. ShelfAnalyzer     — SDI metrics on centre_wall   │
│  │     4. InventoryEstimator — value & category mapping    │
│  │     5. VisualProcessor   — visual score (weighted sum)  │
│  │     6. GeoFeatureExtractor — population, POI, roads     │
│  │     7. GeoProcessor      — geo score (weighted sum)     │
│  │     8. FraudDetector     — rule-based anomaly flags     │
│  │     9. FusionModel       — composite score + decision   │
│  │                                                         │
│  ├── MarketShareModel.predict()  (XGBoost / heuristic)     │
│  └── CreditScoreModel.predict()  (XGBoost / heuristic)     │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────┐
│              frontend/  (Next.js 14)                       │
│  page.tsx → useUnderwrite hook → api.ts → /underwrite      │
│  Results: ResultCard, ConfidenceMeter, FraudFlags,         │
│           LoanSizing, FeatureScores                        │
│  History: HistoryTable ← Supabase PostgreSQL               │
└────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
kirana_khata/
│
├── app.py                        ← FastAPI entry point (POST /underwrite)
├── yolov8n.pt                    ← Pre-trained YOLOv8 nano weights
├── package.json                  ← Root-level convenience scripts
│
├── backend/                      ← Python underwriting engine
│   ├── __init__.py               ← Public exports of all classes
│   ├── image_loader.py           ← ImageLoader: load, resize, enhance 5 images
│   ├── detector.py               ← YOLODetector: wraps Ultralytics YOLO
│   ├── shelf.py                  ← ShelfAnalyzer: SDI_raw, zone SDI, uniformity, depth
│   ├── inventory.py              ← InventoryEstimator: category mapping, INR value
│   ├── visual_processor.py       ← VisualFeatures dataclass + VisualProcessor scorer
│   ├── geo.py                    ← GeoFeatureExtractor: population rings, POI, competition
│   ├── geo_processor.py          ← GeoFeatures dataclass + GeoProcessor scorer
│   ├── fraud.py                  ← FraudDetector: visual/geo/cross-signal rules
│   ├── fusion.py                 ← FusionModel: composite score + APPROVE/REVIEW/REJECT
│   ├── ml_models.py              ← MarketShareModel, CreditScoreModel, ModelRegistry
│   ├── pipeline.py               ← KiranaUnderwriter + KiranaPipeline orchestrators
│   └── requirements.txt
│
└── frontend/                     ← Next.js 14 app
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx            ← Root layout, sticky nav, global CSS
    │   │   ├── page.tsx              ← Main upload + analysis page
    │   │   └── history/
    │   │       └── page.tsx          ← Past analyses page
    │   ├── components/
    │   │   ├── upload/
    │   │   │   ├── ImageUpload.tsx   ← 5-slot drag-and-drop uploader
    │   │   │   └── GpsInput.tsx      ← Lat/lng input with browser geolocation
    │   │   ├── results/
    │   │   │   ├── ResultCard.tsx    ← Daily/monthly sales range + decision badge
    │   │   │   ├── ConfidenceMeter.tsx ← Animated confidence bar
    │   │   │   ├── FraudFlags.tsx    ← Risk flag badges with severity
    │   │   │   ├── LoanSizing.tsx    ← Recommended/min/max loan + EMI
    │   │   │   └── FeatureScores.tsx ← Visual/Geo/Fraud score breakdown
    │   │   ├── history/
    │   │   │   └── HistoryTable.tsx  ← Past analyses from Supabase
    │   │   └── ui/
    │   │       ├── LoadingSpinner.tsx
    │   │       └── ErrorBanner.tsx
    │   ├── hooks/
    │   │   └── useUnderwrite.ts      ← Upload state machine + API call + DB persist
    │   ├── lib/
    │   │   ├── api.ts                ← submitUnderwrite(), response normalization
    │   │   ├── supabase.ts           ← Supabase client setup
    │   │   ├── db.ts                 ← saveUnderwritingResult(), fetchHistory()
    │   │   └── format.ts             ← Currency / number formatters
    │   ├── types/
    │   │   └── underwriting.ts       ← All TypeScript interfaces
    │   └── db/
    │       ├── schema.sql            ← underwriting_results table + indexes + RLS
    │       └── seed.sql              ← Demo data for history page
    ├── .env.local.example
    └── package.json
```

---

## Backend Pipeline — Step by Step

### 1. Image Loading (`image_loader.py`)

`ImageLoader` accepts a dict of exactly 5 paths keyed by:
`front`, `billing_area`, `left_wall`, `centre_wall`, `right_wall`

Per image it:
- Reads via OpenCV (`cv2.imread`)
- Resizes so longest edge ≤ 1280 px (aspect-ratio preserved)
- Computes grayscale mean brightness
- If brightness < 80 → applies **gamma correction (γ=1.5) → CLAHE on LAB L-channel → NLM denoising**
- Returns `LoadedImageSet` with processed numpy arrays + per-image diagnostics

### 2. Object Detection (`detector.py`)

`YOLODetector` wraps Ultralytics YOLO (`yolov8n.pt` by default):
- Runs `model.predict()` across every loaded image
- Returns a flat list of `Detection` objects: `class_name`, `confidence`, `bbox (x1,y1,x2,y2)`, `area_fraction`
- Sorted by confidence descending

### 3. Shelf Analysis (`shelf.py`)

`ShelfAnalyzer` runs on the `centre_wall` image (falls back to `left_wall`):

| Metric | Method |
|--------|--------|
| `sdi_raw` | HSV saturation mask → fraction of non-zero pixels |
| `zone_sdi` | Same mask split into top / eye-level / bottom thirds |
| `sdi_uniformity` | 5-segment wall split → `1 − CV(segment SDIs)` |
| `sdi_depth` | Laplacian variance → normalised against 500 reference |

All scores are 0–1. High `sdi_uniformity` (>0.75) triggers a fraud flag.

### 4. Inventory Estimation (`inventory.py`)

`InventoryEstimator` maps YOLO class names to 3 business categories:

| Category | Examples | Unit value (INR) |
|----------|----------|-----------------|
| `staples` | bowl, banana, apple, carrot | ₹45 |
| `fmcg` | bottle, toothbrush, soap, biscuit | ₹120 |
| `high_margin` | wine glass, cell phone, cake | ₹350 |
| `uncategorised` | everything else | ₹80 |

Outputs: `total_items`, `inventory_value_inr`, `category_ratios`, `fast_moving_fraction`

### 5. Visual Scoring (`visual_processor.py`)

`VisualProcessor.compute_visual_score()` — weighted sum of 6 components:

| Component | Weight | Normalisation |
|-----------|--------|---------------|
| `shelf_occupancy` (= `sdi_raw`) | 0.35 | pass-through (0–1) |
| `product_count` | 0.25 | capped at 200 items |
| `category_diversity` | 0.15 | capped at 30 categories |
| `store_cleanliness` (= `sdi_uniformity`) | 0.10 | pass-through |
| `signage_visible` | 0.05 | front image brightness > 50 |
| `lighting_quality` | 0.10 | mean brightness / 200 |

### 6. Geo Feature Extraction (`geo.py`)

`GeoFeatureExtractor` extracts 4 data classes from coordinates:

- **`PopulationRings`** — estimated population in 0–200 m, 200–500 m, 500–1000 m bands
- **`POICounts`** — schools, hospitals, bus stops, temples, markets, banks
- **`road_type`** — highway / arterial / collector / local / residential
- **`CompetitionInfo`** — kirana count (500 m / 1 km), supermarket count, nearest competitor distance

> Default implementation uses a **deterministic mock** seeded by MD5 of coordinates (same lat/lng always produces same data). Override `_fetch_population`, `_fetch_poi`, `_fetch_road_type`, `_fetch_competition` to wire real APIs (WorldPop, OSM Overpass, Google Places).

### 7. Geo Scoring (`geo_processor.py`)

`GeoProcessor.compute_geo_score()` — weighted sum:

| Component | Weight | Direction |
|-----------|--------|-----------|
| Population density | 0.25 | higher = better (cap 15,000/km²) |
| Competition | 0.25 | fewer + farther = better |
| Footfall index | 0.25 | higher = better |
| Market saturation | 0.15 | lower = better (inverted) |
| Region tier | 0.10 | Tier-1 = 1.0, Tier-2 = 0.75, Tier-3 = 0.50 |

### 8. Fraud Detection (`fraud.py`)

`FraudDetector` runs 3 rule groups:

**Visual rules:**
- `VISUAL_SHELF_EMPTY` (HIGH) — `shelf_occupancy < 0.10`
- `VISUAL_LOW_PRODUCTS` (MEDIUM) — `product_count < 5`
- `VISUAL_POOR_LIGHTING` (LOW) — `lighting_quality < 0.15`

**Geo rules:**
- `GEO_OVERSATURATED` (MEDIUM) — `competitor_count > 15`
- `GEO_MARKET_SATURATED` (HIGH) — `market_saturation > 0.90`

**Cross-signal rules:**
- `CROSS_REVENUE_VS_SHELF` (CRITICAL) — revenue > ₹5L but `shelf_occupancy < 0.20`
- `CROSS_TIER_MISMATCH` (MEDIUM) — claimed tier better than geo-derived tier

Fraud score = `min(Σ severity_weights / 2, 1.0)` where weights are LOW=0.15, MEDIUM=0.40, HIGH=0.70, CRITICAL=1.0.

### 9. Fusion & Decision (`fusion.py`)

`FusionModel.fuse()`:

```
positive  = 0.40 × visual_score + 0.35 × geo_score
penalty   = 0.25 × fraud_score
composite = positive − penalty   (clamped 0–1)

decision  = APPROVE  if composite ≥ 0.65
          = REJECT   if composite ≤ 0.35  OR any CRITICAL flag
          = REVIEW   otherwise

confidence = (1 − |visual − geo|) × (0.5 + 0.5 × distance_to_boundary)
```

Returns `UnderwritingProfile` with `store_id`, `visual_score`, `geo_score`, `fraud_score`, `composite_score`, `decision`, `confidence`, `fraud_flags`, `breakdown`.

### 10. ML Models (`ml_models.py`)

Two XGBoost-backed models (gracefully fall back to sklearn `GradientBoostingRegressor` or deterministic heuristics if neither is installed):

**`MarketShareModel`** — predicts local market share (0–1) from 6 geo features.
**`CreditScoreModel`** — predicts credit score (300–900) from 9 combined features.

`ModelRegistry` auto-loads saved `.pkl` files from `models/` directory if present.

### Financial Transformation (`app.py → transform_to()`)

After the pipeline, `app.py` runs `transform_to()` to produce lender-friendly output:

```python
monthly_revenue = inventory_value × (1 + fast_moving_fraction × 5) × 30
revenue_range   = [monthly_revenue × 0.8, monthly_revenue × 1.2]
daily_range     = [revenue_range[0] / 30, revenue_range[1] / 30]
income_range    = [revenue_range[0] × 0.12, revenue_range[1] × 0.18]
```

---

## API Contract

### Request

```
POST http://localhost:8000/underwrite
Content-Type: multipart/form-data

front:        File   ← Store exterior / frontage
billing_area: File   ← Counter / billing desk
left_wall:    File   ← Left interior wall
centre_wall:  File   ← Centre/back wall (primary shelf analysis image)
right_wall:   File   ← Right interior wall
lat:          float
lng:          float
```

### Response

```json
{
  "store_id": "test",
  "visual_score": 0.312,
  "geo_score": 0.581,
  "fraud_score": 0.175,
  "composite_score": 0.3098,
  "decision": "REJECT",
  "confidence": 0.4401,
  "fraud_flags": [
    { "rule_id": "VISUAL_LOW_PRODUCTS", "severity": "medium", "description": "..." }
  ],
  "breakdown": {
    "visual_contribution": 0.1248,
    "geo_contribution": 0.2034,
    "fraud_penalty": 0.0438
  },
  "ml_outputs": {
    "credit_score": 482,
    "market_share": 0.2731
  },
  "daily_sales_range": [4200, 6300],
  "monthly_revenue_range": [126000, 189000],
  "monthly_income_range": [15120, 34020],
  "risk_flags": ["inventory_footfall_mismatch"],
  "recommendation": "rejected"
}
```

---

## Frontend

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Upload form + live analysis results |
| `/history` | `app/history/page.tsx` | Past analyses from Supabase |

### Key Components

| Component | Purpose |
|-----------|---------|
| `ImageUpload.tsx` | 5-slot grid with drag-and-drop, slot labels (Front / Billing Area / Left Wall / Centre Wall / Right Wall), 10 MB limit, JPEG/PNG/WebP/HEIC |
| `GpsInput.tsx` | Lat/lng inputs + browser `getCurrentPosition()` button |
| `ResultCard.tsx` | Daily sales range, monthly revenue, decision badge |
| `ConfidenceMeter.tsx` | Animated horizontal bar (0–100%) |
| `FraudFlags.tsx` | Colour-coded badges (low=green, medium=amber, high/critical=red) |
| `LoanSizing.tsx` | Recommended / min / max loan, tenure, interest rate, EMI |
| `FeatureScores.tsx` | Visual / Geo / Fraud Safety score bars with weights |
| `HistoryTable.tsx` | Paginated table of past analyses from Supabase |

### Data Flow

```
User uploads 5 images + GPS
        ↓
useUnderwrite.submit()
    status: idle → uploading → analyzing
        ↓
api.ts → submitUnderwrite()
    • Builds FormData (front, billing_area, left_wall, centre_wall, right_wall)
    • POST http://127.0.0.1:8000/underwrite
    • Normalizes response:
        - Maps APPROVE/REVIEW/REJECT → approve/review/reject
        - Computes midpoint revenue & income
        - Builds feature_scores[] array (Visual 40%, Geo 30%, Fraud Safety 30%)
        - Computes loan_sizing from revenue midpoint
        - Merges pipeline fraud_flags + risk_flags
        - Derives risk_score = (1 − composite_score) × 100
        ↓
db.ts → saveUnderwritingResult()  (non-fatal — won't block UI on failure)
    • Inserts into Supabase underwriting_results table
        ↓
status: done → renders result components
```

### TypeScript Interfaces

```typescript
interface UnderwritingResult {
  id: string;
  store_name: string;
  monthly_revenue: number;
  monthly_profit: number;
  confidence: number;        // 0–1
  risk_score: number;        // 0–100 (lower = better)
  decision: 'approve' | 'reject' | 'review';
  fraud_flags: FraudFlag[];
  loan_sizing: LoanSizing;
  feature_scores: FeatureScore[];
  location: GpsCoordinates;
  images_count: number;
  created_at: string;
}
```

---

## Database (Supabase / PostgreSQL)

Single table `underwriting_results`:

```sql
id             text primary key
store_name     text
owner_name     text
monthly_revenue numeric(14,2)
monthly_profit  numeric(14,2)
confidence      numeric(5,4)   -- CHECK 0 ≤ x ≤ 1
risk_score      integer        -- CHECK 0 ≤ x ≤ 100
decision        text           -- CHECK IN ('approve','review','reject')
fraud_flags     jsonb
loan_sizing     jsonb
feature_scores  jsonb
location        jsonb          -- {lat, lng, accuracy}
images_count    integer
created_at      timestamptz
```

Indexes on `created_at DESC`, `decision`, `risk_score`. Row Level Security enabled. A `underwriting_summary` view is created for the history table query.

---

## Setup & Running

### Backend

**Prerequisites:** Python 3.10+, pip

```bash
cd kirana_khata
pip install -r backend/requirements.txt

# Run the FastAPI server
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`. The YOLO model (`yolov8n.pt`) is loaded lazily on the first `/underwrite` request.

> **Note:** First request loads YOLOv8 weights (~6.5 MB) — expect ~2–3s cold start.

### Frontend

**Prerequisites:** Node.js 18+

```bash
cd kirana_khata/frontend
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Database

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste `frontend/src/db/schema.sql` → **Run**
3. Optionally paste `frontend/src/db/seed.sql` for demo history data
4. Copy **Project URL** and **anon public** key into `.env.local`

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL (leave blank for mock mode) | `http://localhost:8000` |
| `NEXT_PUBLIC_MOCK_MODE` | Force mock data | `true` / `false` |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| API server | FastAPI + Uvicorn | latest |
| Computer vision | Ultralytics YOLOv8 | `yolov8n.pt` |
| Image processing | OpenCV (`cv2`) | latest |
| ML models | XGBoost / scikit-learn | latest |
| Frontend framework | Next.js (App Router) | 14.2.4 |
| UI language | TypeScript | 5.x |
| Styling | Tailwind CSS + custom CSS vars | 3.x |
| Database client | @supabase/supabase-js | 2.x |
| Database | PostgreSQL via Supabase | — |

---

## Fraud Detection Reference

| Flag | Severity | Trigger condition |
|------|----------|------------------|
| `VISUAL_SHELF_EMPTY` | HIGH | `shelf_occupancy < 0.10` |
| `VISUAL_LOW_PRODUCTS` | MEDIUM | `product_count < 5` |
| `VISUAL_POOR_LIGHTING` | LOW | `lighting_quality < 0.15` |
| `GEO_OVERSATURATED` | MEDIUM | `competitor_count > 15` |
| `GEO_MARKET_SATURATED` | HIGH | `market_saturation > 0.90` |
| `CROSS_REVENUE_VS_SHELF` | CRITICAL | `monthly_revenue > ₹5L` AND `shelf_occupancy < 0.20` |
| `CROSS_TIER_MISMATCH` | MEDIUM | Claimed region tier better than geo-derived |

---

## Image Slot Reference

Each submission must include all five views in this exact order:

| Slot | Key | What to capture |
|------|-----|----------------|
| 1 | `front` | Store exterior / signage / entrance |
| 2 | `billing_area` | Counter / cash desk / POS area |
| 3 | `left_wall` | Left interior shelf wall |
| 4 | `centre_wall` | Centre / back wall (primary shelf analysis) |
| 5 | `right_wall` | Right interior shelf wall |

---

## Demo Instructions

1. Start the backend: `uvicorn app:app --reload` (from `kirana_khata/`)
2. Start the frontend: `npm run dev` (from `kirana_khata/frontend/`)
3. Open `http://localhost:3000`
4. Upload 5 kirana store images (search "kirana store interior" on Google Images)
5. Enter GPS: `19.0596, 72.8295` (Mumbai residential area)
6. Click **Analyze Store**
7. Walk through: cash flow range, confidence score, fraud flags, loan recommendation
8. Visit `/history` to show Supabase storing past analyses

---

## License

Built for hackathon purposes. All rights reserved.
