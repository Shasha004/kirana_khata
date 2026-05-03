from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import tempfile, shutil, os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"status": "ok"}


# ==============================
# 🔥 TRANSFORMATION FUNCTION
# ==============================
def transform_to(output, ml, fin_data):
    inventory = output.get("metadata", {}).get("inventory", {})
    shelf = output.get("metadata", {}).get("shelf_metrics", {})

    inventory_value = inventory.get("inventory_value_inr", 1000)
    fast_moving = inventory.get("fast_moving_fraction", 0.2)
    sdi_raw = shelf.get("sdi_raw", 0.5)

    # User inputs
    rent = fin_data.get("rent") or 15000
    shop_size = fin_data.get("shop_size") or 200
    years = fin_data.get("years_in_operation") or 2

    # 1. Multi-Modal Fusion (incorporate geo and diversity)
    geo_score = output.get("geo_score", 0.5)
    
    cat_counts = inventory.get("category_counts", {})
    sku_diversity = sum(1 for v in cat_counts.values() if v > 0) / max(len(cat_counts), 1)

    # Better Monthly Revenue Formula using all signals
    monthly_revenue = int(
        inventory_value * (1 + fast_moving * 3) * 30 
        * (0.5 + geo_score) * (0.8 + sku_diversity * 0.5)
    )

    # 2. Dynamic Uncertainty Bands
    confidence = output.get("confidence", 0.72)

    # 🔥 Boost confidence if store is established (> 5 years)
    if years >= 5:
        confidence = min(confidence + 0.1, 0.95)
    
    # Lower confidence = wider uncertainty band
    uncertainty_margin = 0.4 - (confidence * 0.3) 

    revenue_range = [
        int(monthly_revenue * (1 - uncertainty_margin)),
        int(monthly_revenue * (1 + uncertainty_margin)),
    ]

    daily_range = [
        int(revenue_range[0] / 30),
        int(revenue_range[1] / 30),
    ]

    # 🔥 Monthly income = Gross Margin - Rent
    income_range = [
        max(1000, int(revenue_range[0] * 0.15) - rent),
        max(2000, int(revenue_range[1] * 0.22) - rent),
    ]

    # 🔥 Risk flags & Refill Signals
    risk_flags = []

    # 3. Refill Signal Check
    if sdi_raw > 0.95:
        risk_flags.append("suspiciously_overstocked")
    elif sdi_raw < 0.2:
        risk_flags.append("critically_low_stock")

    # 4. Cross-signal fraud validation
    if inventory_value > 50000 and geo_score < 0.3:
        risk_flags.append("inventory_footfall_mismatch")

    # 🔥 Shop Size Fraud Check: Claiming 1000 sqft but detecting almost no products
    if shop_size > 800 and inventory.get("total_items", 0) < 15:
        risk_flags.append("claimed_size_vs_inventory_mismatch")

    if inventory.get("total_items", 0) < 10:
        risk_flags.append("limited_view_coverage")

    if len(output.get("fraud_flags", [])) > 0:
        risk_flags.append("high_competition")

    decision_map = {
        "APPROVE": "approved",
        "REVIEW": "needs_verification",
        "REJECT": "rejected"
    }

    recommendation = decision_map.get(output.get("decision", "REVIEW"), "needs_verification")

    return {
        "daily_sales_range": daily_range,
        "monthly_revenue_range": revenue_range,
        "monthly_income_range": income_range,
        "confidence_score": round(confidence, 2),
        "risk_flags": risk_flags,
        "recommendation": recommendation
    }


# ==============================
# 🚀 MAIN API
# ==============================
@app.post("/underwrite")
async def underwrite(
    front: UploadFile = File(...),
    billing_area: UploadFile = File(...),
    left_wall: UploadFile = File(...),
    centre_wall: UploadFile = File(...),
    right_wall: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    shop_size: Optional[int] = Form(None),
    rent: Optional[int] = Form(None),
    years_in_operation: Optional[int] = Form(None)
):
    try:
        from backend import KiranaPipeline

        pipeline = KiranaPipeline()

        with tempfile.TemporaryDirectory() as tmpdir:
            paths = {}

            files = {
                "front": front,
                "billing_area": billing_area,
                "left_wall": left_wall,
                "centre_wall": centre_wall,
                "right_wall": right_wall,
            }

            for key, file in files.items():
                path = os.path.join(tmpdir, f"{key}.jpg")
                with open(path, "wb") as f:
                    shutil.copyfileobj(file.file, f)
                paths[key] = path

            fin_data = {
                "shop_size": shop_size,
                "rent": rent,
                "years_in_operation": years_in_operation,
            }

            result = pipeline.run({
                "store_id": "test",
                "image_paths": paths,
                "latitude": lat,
                "longitude": lng,
                "financial_data": fin_data
            })

        # 🔥 EXTRACT
        output = result.get("underwriting_output", {})
        ml = result.get("ml_outputs", {})

        # 🔥 TRANSFORM (financial estimates)
        financial = transform_to(output, ml, fin_data)

        # 🔥 MERGE: raw pipeline scores + financial estimates + ML
        return {
            **output,          # visual_score, geo_score, fraud_score, etc.
            **financial,       # monthly_revenue_range, risk_flags, etc.
            "ml_outputs": ml,  # credit_score, market_share
        }

    except Exception as e:
        return {"error": str(e)}