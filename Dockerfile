# Production Dockerfile for Kirana Khata ML/FastAPI Backend
FROM python:3.10-slim

# System packages required for OpenCV and deep learning models
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for caching optimization
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache the YOLOv8 nano model so runtime boots instantly in the cloud
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy full backend application
COPY backend/ ./backend/
COPY app.py .
COPY yolov8n.pt .

# Set dynamic port binding (Hugging Face Spaces listens on port 7860 by default)
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
