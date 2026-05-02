from fastapi import FastAPI

app = FastAPI(title="Kirana Khata Backend", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Welcome to Kirana Khata Backend"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}