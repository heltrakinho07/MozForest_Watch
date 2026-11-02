"""REST API — authentication/quotas remain server-side."""
import csv
import io
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .config import get_settings
from .constants import DATASET_HANSEN, DISTRICTS, FIRST_YEAR, LAST_YEAR
from .geospatial import annual_series, district_boundary, district_catalog, initialize, map_tile

logging.basicConfig(level="INFO")
logger = logging.getLogger("mozforest")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="MozForest Watch API", version="0.2.0", lifespan=lifespan,
    description="Monitorização geoespacial exploratória da perda de cobertura arbórea em Moçambique.",
)
app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().origins,
    allow_methods=["GET"], allow_headers=["*"], allow_credentials=False
)

def safe_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception:
        logger.exception("Earth Engine operation failed")
        raise HTTPException(status_code=503, detail="Earth Engine indisponível. Verifique o projecto e as credenciais do backend.")

@app.get("/api/health")
def health():
    settings = get_settings()
    return {"status": "ok", "gee_configured": bool(settings.gee_project),
            "source": DATASET_HANSEN, "scope": "Zambézia"}

@app.get("/api/districts")
def districts():
    return safe_call(district_catalog)

@app.get("/api/series/{district}")
def series(district: str, threshold: int = Query(30, ge=1, le=100)):
    return safe_call(annual_series, district, threshold)

@app.get("/api/boundary/{district}")
def boundary(district: str):
    return safe_call(district_boundary, district)

@app.get("/api/tiles/{district}")
def tiles(
    district: str,
    mode: str = Query("loss_year", pattern="^(loss_year|loss_total|cover|sentinel)$"),
    year: int = Query(2025, ge=FIRST_YEAR, le=LAST_YEAR),
    threshold: int = Query(30, ge=1, le=100),
):
    return safe_call(map_tile, district, mode, year, threshold)

@app.get("/api/export/{district}.csv")
def export_csv(district: str, threshold: int = Query(30, ge=1, le=100)):
    payload = safe_call(annual_series, district, threshold)
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["district", "year", "loss_ha", "canopy_threshold_2000_pct", "dataset"])
    for row in payload["rows"]:
        writer.writerow([district, row["year"], row["loss_ha"], threshold, DATASET_HANSEN])
    stream.seek(0)
    return StreamingResponse(
        iter([stream.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=mozforest_{DISTRICTS.index(district) + 1}_loss.csv"}
    )
