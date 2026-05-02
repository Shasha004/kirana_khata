from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
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
def transform_to(output, ml):
    inventory = output["metadata"]["inventory"]
    shelf = output["metadata"]["shelf_metrics"]

    inventory_value = inventory.get("inventory_value_inr", 1000)
    fast_moving = inventory.get("fast_moving_fraction", 0.2)

    # 🔥 Monthly revenue estimation
    monthly_revenue = int(inventory_value * (1 + fast_moving * 5) * 30)

    revenue_range = [
        int(monthly_revenue * 0.8),
        int(monthly_revenue * 1.2),
    ]

    # Daily sales
    daily_range = [
        int(revenue_range[0] / 30),
        int(revenue_range[1] / 30),
    ]

    # Monthly income
    income_range = [
        int(revenue_range[0] * 0.12),
        int(revenue_range[1] * 0.18),
    ]

    # 🔥 Risk flags
    risk_flags = []

    if shelf.get("sdi_uniformity", 0) > 0.75:
        risk_flags.append("inventory_footfall_mismatch")

    if inventory.get("total_items", 0) < 10:
        risk_flags.append("limited_view_coverage")

    if len(output.get("fraud_flags", [])) > 0:
        risk_flags.append("high_competition")

    # 🔥 Decision mapping
    decision_map = {
        "APPROVE": "approved",
        "REVIEW": "needs_verification",
        "REJECT": "rejected"
    }

    recommendation = decision_map.get(output["decision"], "needs_verification")

    return {
        "daily_sales_range": daily_range,
        "monthly_revenue_range": revenue_range,
        "monthly_income_range": income_range,
        "confidence_score": round(output["confidence"], 2),
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
    lng: float = Form(...)
):
    try:
        # lazy import
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

            result = pipeline.run({
                "store_id": "test",
                "image_paths": paths,
                "latitude": lat,
                "longitude": lng,
            })

        # 🔥 EXTRACT
        output = result.get("underwriting_output", {})
        ml = result.get("ml_outputs", {})

        # 🔥 TRANSFORM (financial estimates)
        financial = transform_to(output, ml)

        # 🔥 MERGE: raw pipeline scores + financial estimates + ML
        return {
            **output,          # visual_score, geo_score, fraud_score, etc.
            **financial,       # monthly_revenue_range, risk_flags, etc.
            "ml_outputs": ml,  # credit_score, market_share
        }

    except Exception as e:
        return {"error": str(e)}