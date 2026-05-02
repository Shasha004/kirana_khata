# Kirana Underwriting System

> Remote cash flow underwriting for India's 13 million kirana stores — using shop images + GPS, no transaction data required.

---

## What This Is

Banks and NBFCs want to give loans to small kirana (grocery) store owners, but these shops have no bank statements, no GST records, and no formal bookkeeping. A field officer visiting every shop is slow, expensive, and gameable.

This system solves that. A loan officer uploads **5 photos of the shop** and drops a **GPS pin**. The system outputs a calibrated daily cash flow estimate (e.g. ₹6,000–₹9,000/day), a confidence score, fraud risk flags, and a loan sizing recommendation — fully automated, in seconds.

---

## How It Works

The system has three independently built services that connect via a single API call:

```
5 shop images + GPS
        │
        ▼
┌───────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   ML Service      │────▶│   Backend (FastAPI)   │────▶│  Frontend       │
│   (YOLOv8)        │     │                       │     │  (Next.js)      │
│                   │     │  • Geo engine (OSM)   │     │                 │
│  Detects objects, │     │  • Fraud detector     │     │  Displays range,│
│  estimates shelf  │     │  • Fusion model       │     │  confidence,    │
│  fill, inventory  │     │  • Monte Carlo        │     │  loan sizing    │
└───────────────────┘     └──────────┬────────────┘     └─────────────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  Database (Supabase) │
                          │  PostgreSQL           │
                          │  Stores all results   │
                          └──────────────────────┘
```

### The Economic Model (the smart part)

Cash flow is estimated two independent ways, then reconciled:

**Supply-side:** `Effective Working Capital ÷ Turnover Days = Daily Sales`
→ A shop with ₹1.2L inventory and 60% fast-moving goods turns over in ~17 days → ~₹7,000/day

**Demand-side:** `Population × Per-capita Spend × Market Share = Daily Sales`
→ 2,000 people within 200m, ₹18/day FMCG spend, 30% market share → ~₹10,800/day

**Reconciliation:** Harmonic mean of both estimates. If they diverge by more than 2.5×, a fraud flag is raised.

**Uncertainty:** 500 Monte Carlo iterations over input ranges → output is a calibrated range, not a point estimate.

---

## Team Structure

| Person | Role | Tech Stack |
|--------|------|------------|
| **You** | Frontend + Database | Next.js 14, React, TypeScript, Tailwind, Supabase |
| **Teammate 2** | Full-stack (Backend + Geo + Fusion) | FastAPI, Python, NumPy, OpenStreetMap |
| **Teammate 3** | ML (Vision features) | YOLOv8, OpenCV, Python |

---

## Repository Structure

```
kirana-underwriting/
│
├── kirana-ui/                    ← YOUR repo (frontend + DB)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          ← Main upload + analysis page
│   │   │   ├── layout.tsx        ← Root layout, fonts, metadata
│   │   │   └── history/
│   │   │       └── page.tsx      ← Past analyses page
│   │   ├── components/
│   │   │   ├── upload/
│   │   │   │   ├── ImageUpload.tsx      ← 5-zone drag-and-drop uploader
│   │   │   │   └── GpsInput.tsx         ← Lat/lon input with geolocation
│   │   │   ├── results/
│   │   │   │   ├── ResultCard.tsx       ← Daily/monthly sales range
│   │   │   │   ├── ConfidenceMeter.tsx  ← Animated confidence bar
│   │   │   │   ├── FraudFlags.tsx       ← Risk flag badges
│   │   │   │   ├── LoanSizing.tsx       ← Max loan, EMI, affordability
│   │   │   │   └── FeatureScores.tsx    ← SDI, footfall, SKU breakdown
│   │   │   ├── history/
│   │   │   │   └── HistoryTable.tsx     ← Past analyses from DB
│   │   │   └── ui/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorBanner.tsx
│   │   ├── lib/
│   │   │   ├── api.ts            ← POST to backend, mock mode flag
│   │   │   ├── supabase.ts       ← Supabase client setup
│   │   │   └── db.ts             ← saveResult(), getHistory()
│   │   ├── hooks/
│   │   │   └── useUnderwrite.ts  ← Upload state + API call logic
│   │   └── types/
│   │       └── underwriting.ts   ← All TypeScript interfaces
│   ├── db/
│   │   ├── schema.sql            ← 3 tables: requests, results, flags
│   │   └── seed.sql              ← Demo data for history page
│   ├── .env.local.example        ← Environment variable template
│   ├── package.json
│   └── README.md                 ← This file
│
├── kirana-backend/               ← Full-stack teammate's repo
│   ├── main.py
│   ├── routers/underwrite.py
│   ├── geo/
│   ├── engine/
│   └── Dockerfile
│
└── kirana-ml/                    ← ML teammate's repo
    ├── ml/mock_vision.py
    ├── ml/visual_processor.py
    └── ml/yolo_detector.py
```

---

## Your Setup (Frontend + Database)

### Prerequisites

- Node.js 18+ → [nodejs.org](https://nodejs.org)
- A Supabase account (free) → [supabase.com](https://supabase.com)
- Git

### Step 1 — Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/kirana-ui.git
cd kirana-ui
npm install
```

### Step 2 — Set up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) → Sign up → **New Project** → name it `kirana`
2. Wait ~2 minutes for it to provision
3. Go to **SQL Editor** → paste the contents of `db/schema.sql` → click **Run**
4. Go to **Settings → API** → copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 3 — Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MOCK_MODE=true
```

> Set `MOCK_MODE=true` while the backend isn't ready. The app works with fake data so you can build and demo the UI independently.

### Step 4 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the full upload interface. Upload any 5 images, enter any lat/lon (e.g. `19.0760`, `72.8777` for Mumbai), click Analyze.

### Step 5 — Connect to real backend

Once your full-stack teammate has their FastAPI server running:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MOCK_MODE=false
```

Restart the dev server. The same UI now calls the real backend.

---

## Database Schema

Three tables. Run `db/schema.sql` in Supabase SQL Editor to create them.

```sql
underwriting_requests   -- one row per analysis (lat, lon, timestamp)
underwriting_results    -- cash flow range, confidence, loan sizing
risk_flags              -- one row per flag raised (e.g. sdi_uniformity_high)
```

Full schema is in `db/schema.sql`.

---

## API Contract

Your frontend calls one endpoint on the backend:

### Request

```
POST http://localhost:8000/api/underwrite
Content-Type: multipart/form-data

images[0..4]: File   ← 5 shop images (exterior, counter, left wall, right wall, back wall)
lat: "19.0760"
lon: "72.8777"
```

### Response

```json
{
  "daily_sales_range": [6000, 9000],
  "monthly_revenue_range": [180000, 270000],
  "monthly_income_range": [21600, 32400],
  "confidence_score": 0.71,
  "confidence_derivation": {
    "supply_estimate_daily": [5500, 8200],
    "demand_estimate_daily": [6800, 10500],
    "divergence_ratio": 1.28,
    "monte_carlo_cv": 0.11,
    "base_confidence": 0.82
  },
  "feature_scores": {
    "sdi_adjusted": 0.63,
    "refill_signal": 0.80,
    "sku_weighted": 0.71,
    "catchment_score": 0.58,
    "footfall_score": 0.66,
    "competition_penalty": -0.12,
    "fraud_adjustment": -0.11
  },
  "risk_flags": ["sdi_uniformity_high", "organized_retail_proximity_1km"],
  "recommendation": "needs_verification",
  "loan_sizing": {
    "max_loan_amount": 75000,
    "suggested_emi": 6048,
    "affordability_ratio": 0.28
  }
}
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | `eyJ...` |
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:8000` |
| `NEXT_PUBLIC_MOCK_MODE` | Use fake data instead of real backend | `true` / `false` |

---

## Deployment

### Frontend → Vercel (free, 2 minutes)

```bash
npx vercel
```

Follow the prompts. Then go to **Vercel Dashboard → Settings → Environment Variables** and add all 4 variables from above (with `NEXT_PUBLIC_API_URL` pointing to your deployed backend, and `NEXT_PUBLIC_MOCK_MODE=false`).

### Database → Already deployed

Supabase is cloud-hosted. Nothing to deploy. Just make sure your Vercel environment variables point to the right Supabase project.

---

## Key Design Decisions

**Why harmonic mean?**
Arithmetic mean rewards inconsistency. If supply says ₹3,000/day and demand says ₹12,000/day, arithmetic gives ₹7,500 — ignoring the contradiction. Harmonic mean gives ₹4,800 and raises a flag. The inconsistency itself is signal.

**Why Monte Carlo for uncertainty?**
Instead of manually assigning confidence, we sample 500 times over the uncertainty range of each input. A store with consistent signals produces a tight distribution (high confidence). Contradictory signals produce a wide distribution (low confidence). The confidence score is derived, not guessed.

**Why 5 images with overlap constraints?**
The overlap requirement (each wall image must show the adjacent wall's edge) makes selective photography detectable. A shopkeeper can't just photograph their best-stocked wall — the algorithm checks for edge continuity.

**Why not train a custom ML model?**
This is a latent variable estimation problem with no ground truth labels — you can't label "true cash flow" for training. The economic model is more interpretable, more robust to distribution shift, and requires no training data. YOLOv8 (pre-trained) handles the vision; the economics handles the inference.

---

## Fraud Detection

Five specific adversarial attacks are modeled, each with a detection mechanism:

| Threat | How they cheat | How we catch it |
|--------|---------------|-----------------|
| Inspection-day overstock | Borrow inventory from neighbors | SDI uniformity > 0.75 across all 4 walls |
| Selective photography | Only photograph best-stocked wall | Image overlap constraint check |
| Planted high-value props | Place electronics to inflate value | luxury_ratio > 0.15 |
| GPS spoofing | Submit GPS of high-footfall area | Street View embedding similarity |
| Inventory-footfall mismatch | High stock, low-demand location | inventory > ₹2L and footfall_score < 0.35 |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) | Fast, SEO-ready, easy deployment |
| Styling | Tailwind CSS | Utility-first, rapid iteration |
| Language | TypeScript | Type safety catches bugs early |
| Database client | Supabase JS SDK | Real-time, auth-ready, free |
| Database | PostgreSQL (Supabase) | Reliable, relational, free tier |
| Deployment | Vercel | Zero-config, instant deploys |

---

## Demo Instructions

For the hackathon demo:

1. Open the live Vercel URL
2. Upload 5 kirana store images (downloaded from Google Images — search "kirana store interior")
3. Enter GPS coordinates of a Mumbai residential area: `19.0596, 72.8295`
4. Click **Analyze Store**
5. Walk judges through: the cash flow range, confidence score, fraud flags, and loan recommendation
6. Click **View History** to show the database storing past analyses

**Talking points:**
- "The intelligence is not in the AI — it's in the economics. Supply-side and demand-side estimates are computed independently and reconciled."
- "The confidence score is not assigned — it emerges from 500 Monte Carlo simulations over input uncertainty."
- "Each fraud flag maps to a specific adversarial attack vector we modeled upfront."

---

## Contributing

Each team member works in their own repo. Integration happens through the agreed API contract. If the API response shape needs to change, update `src/types/underwriting.ts` and notify all teammates.

---

## License

Built for hackathon purposes. All rights reserved.
