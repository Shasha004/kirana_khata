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


@app.post("/underwrite")
async def underwrite(
    storefront: UploadFile = File(...),
    interior_wide: UploadFile = File(...),
    shelf_close: UploadFile = File(...),
    billing_area: UploadFile = File(...),
    signage: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...)
):
    try:
        # 🔥 lazy import (important)
        from backend import KiranaPipeline

        pipeline = KiranaPipeline()

        with tempfile.TemporaryDirectory() as tmpdir:
            paths = {}

            files = {
                "storefront": storefront,
                "interior_wide": interior_wide,
                "shelf_close": shelf_close,
                "billing_area": billing_area,
                "signage": signage,
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

        return result

    except Exception as e:
        return {"error": str(e)}