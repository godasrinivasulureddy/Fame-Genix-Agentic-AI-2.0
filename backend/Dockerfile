# FAME-GENIX 2.0 Backend — FastAPI clinical AI engine
# One-command: docker compose up --build
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Persisted SQLite DB (volume mounted at /data)
    DATABASE_URL=sqlite:////data/fame_genix.db \
    ENVIRONMENT=production \
    SIMULATION_MODE=true

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Persisted SQLite database volume
VOLUME ["/data"]

EXPOSE 8000

# Run the FastAPI engine (init_db runs on startup via on_event)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
