import os
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure current directory is in sys.path for relative submodule resolution
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

load_dotenv()

try:
    from routers import indoor_temp, design, thermal_energy, optimization, heat_flow
    from services import model_loader, climate
    from catalog import MATERIALS, MATERIAL_COSTS_INR_PER_M3
    from routers.heat_flow import MATERIAL_THERMAL_MASS
except ImportError:
    from backend.routers import indoor_temp, design, thermal_energy, optimization, heat_flow
    from backend.services import model_loader
    from backend.services import climate
    from backend.catalog import MATERIALS, MATERIAL_COSTS_INR_PER_M3
    from backend.routers.heat_flow import MATERIAL_THERMAL_MASS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Load all ML models into memory at startup — not per-request."""
    logger.info("Loading ML model artifacts...")
    try:
        model_loader.load_all()
        logger.info("All models loaded successfully.")
    except FileNotFoundError as e:
        logger.error("Model loading failed: %s", e)
        logger.error(
            "Run 'python scripts/export_models.py' to generate model artifacts."
        )
    yield


app = FastAPI(
    title="Cold-Climate Shelter Thermal Comfort API",
    description="Microservice backend for passive shelter thermal comfort design & optimization (Ladakh region).",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = [
    frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health endpoint
@app.get("/health", tags=["System"])
def health_check():
    ready = model_loader.is_ready()
    return {"status": "ok" if ready else "degraded", "models_loaded": ready}


@app.get("/climate", tags=["Climate Data"])
def climate_data(latitude: float, longitude: float, start: str | None = None, end: str | None = None):
    """Return cached/retrieved NASA POWER climate values for a location."""
    from datetime import date
    from fastapi import HTTPException

    try:
        result = climate.get_climate(
            latitude, longitude,
            date.fromisoformat(start) if start else None,
            date.fromisoformat(end) if end else None,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result.__dict__


@app.get("/materials", tags=["Material Data"])
def material_catalog():
    """Expose the canonical material values used by physics and optimization."""
    return {
        name: {
            "thermal_mass_MJ_m3K": MATERIAL_THERMAL_MASS[name],
            "k_W_mK": MATERIALS[name]["u_value"],
            "lsor_cost_inr_m3": MATERIAL_COSTS_INR_PER_M3[name],
        }
        for name in ("Concrete", "Mud_Brick", "Rammed_Earth", "Stone")
    }

# Mount prediction routers
app.include_router(indoor_temp.router)
app.include_router(design.router)
app.include_router(thermal_energy.router)
app.include_router(optimization.router)
app.include_router(heat_flow.router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
