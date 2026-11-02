"""Earth Engine calculations. No invented area or shapefile fallbacks."""
import logging
import unicodedata
from functools import lru_cache
from typing import Any
import ee

from .config import get_settings
from .constants import (
    DATASET_HANSEN, DATASET_SENTINEL, DISTRICTS,
    DISTRICT_ALIASES, FIRST_YEAR, LAST_YEAR,
)

log = logging.getLogger(__name__)

def canonical(text: str) -> str:
    return " ".join("".join(ch for ch in unicodedata.normalize("NFKD", text.casefold())
                      if not unicodedata.combining(ch)).split())

def is_zambezia(name: str) -> bool:
    return canonical(name) in ("zambezia", "zambesia")

@lru_cache(maxsize=1)
def initialize() -> bool:
    project = get_settings().gee_project
    if not project:
        raise RuntimeError("GEE_PROJECT não configurado no servidor.")
    ee.Initialize(project=project)
    return True

@lru_cache(maxsize=1)
def district_catalog() -> dict[str, Any]:
    initialize()
    collection = ee.FeatureCollection(get_settings().gee_boundary_asset).filter(
        ee.Filter.eq("ISO3_CODE", "MOZ")
    )
    # Request attributes only; don't transport all national boundary geometries.
    entries = collection.reduceColumns(
        ee.Reducer.toList(3), ["GAUL1_NAME", "GAUL2_NAME", "GAUL2_CODE"]
    ).get("list").getInfo() or []
    found: dict[str, dict[str, Any]] = {}
    unresolved = []
    for label in DISTRICTS:
        matches = [
            {"name": row[1], "code": row[2], "province": row[0]}
            for row in entries
            if row[0] and row[1] and is_zambezia(str(row[0]))
            and canonical(str(row[1])) in DISTRICT_ALIASES[label]
        ]
        if len(matches) == 1:
            found[label] = matches[0]
        else:
            unresolved.append({
                "name": label,
                "reason": "ausente" if not matches else "ambíguo",
                "matches": matches,
            })
    return {
        "available": [{"name": name, **detail} for name, detail in found.items()],
        "unresolved": unresolved,
        "source": get_settings().gee_boundary_asset,
        "count": len(found),
    }

def district_geometry(district: str):
    if district not in DISTRICTS:
        raise ValueError("Distrito não incluído neste estudo.")
    record = next((r for r in district_catalog()["available"] if r["name"] == district), None)
    if record is None:
        raise ValueError(f"Limite geográfico de {district} por validar. Não são utilizadas aproximações.")
    boundary = ee.FeatureCollection(get_settings().gee_boundary_asset)
    return boundary.filter(ee.Filter.eq("GAUL2_CODE", record["code"])).geometry()

def _base_image(threshold: int):
    image = ee.Image(DATASET_HANSEN)
    # Restrict to originally vegetated 2000 pixels and valid land.
    mask = image.select("treecover2000").gte(threshold).And(image.select("datamask").eq(1))
    return image, mask

@lru_cache(maxsize=64)
def annual_series(district: str, threshold: int) -> dict[str, Any]:
    initialize()
    geom = district_geometry(district)
    image, baseline = _base_image(threshold)
    loss_year = image.select("lossyear")
    area = ee.Image.pixelArea().divide(10000).rename("hectares")
    valid_loss = loss_year.updateMask(baseline.And(loss_year.gt(0)))
    summarized = area.updateMask(valid_loss.mask()).addBands(valid_loss.rename("year")).reduceRegion(
        reducer=ee.Reducer.sum().group(groupField=1, groupName="year"),
        geometry=geom,
        scale=30,
        maxPixels=1e11,
        tileScale=8,
    ).getInfo() or {}
    by_year = {FIRST_YEAR + int(item["year"]) - 1: float(item["sum"])
               for item in summarized.get("groups", [])}
    rows = [{"year": year, "loss_ha": round(by_year.get(year, 0.0), 2)}
            for year in range(FIRST_YEAR, LAST_YEAR + 1)]
    baseline_stats = area.updateMask(baseline).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=geom, scale=30,
        maxPixels=1e11, tileScale=8
    ).getInfo() or {}
    base_ha = float(baseline_stats.get("hectares") or 0.0)
    total = round(sum(x["loss_ha"] for x in rows), 2)
    return {
        "district": district,
        "threshold": threshold,
        "year_start": FIRST_YEAR,
        "year_end": LAST_YEAR,
        "baseline_ha": round(base_ha, 2),
        "total_loss_ha": total,
        "loss_pct_baseline": round(total / base_ha * 100, 2) if base_ha else None,
        "rows": rows,
        "source": DATASET_HANSEN,
        "method": "Hansen lossyear; canopy 2000 >= threshold; pixelArea; native 30 m analysis scale.",
        "warning": "Perda de cobertura arbórea não é equivalente a desflorestação permanente ou ilegal.",
    }

def map_tile(district: str, mode: str, year: int, threshold: int) -> dict[str, str]:
    initialize()
    geom = district_geometry(district)
    img, baseline = _base_image(threshold)
    if mode == "loss_year":
        layer = img.select("lossyear").eq(year - 2000).And(baseline).selfMask().clip(geom)
        vis = {"min": 0, "max": 1, "palette": ["#F97360"]}
    elif mode == "loss_total":
        layer = img.select("lossyear").gt(0).And(img.select("lossyear").lte(year - 2000)).And(baseline).selfMask().clip(geom)
        vis = {"min": 0, "max": 1, "palette": ["#F97360"]}
    elif mode == "cover":
        layer = img.select("treecover2000").updateMask(baseline).clip(geom)
        vis = {"min": 0, "max": 100, "palette": ["#A7DBA1", "#146C4B", "#043F34"]}
    elif mode == "sentinel":
        if year < 2017:
            raise ValueError("Sentinel-2 SR apenas disponível neste modo para anos desde 2017.")
        collection = (ee.ImageCollection(DATASET_SENTINEL)
            .filterBounds(geom)
            .filterDate(f"{year}-01-01", f"{year + 1}-01-01")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60)))
        if collection.size().getInfo() == 0:
            raise ValueError("Sem imagens Sentinel-2 SR disponíveis para o ano e distrito escolhidos.")
        def mask_clouds(scene):
            scl = scene.select("SCL")
            keep = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11))
            return scene.updateMask(keep)
        layer = collection.map(mask_clouds).median().select(["B4", "B3", "B2"]).clip(geom)
        vis = {"bands": ["B4", "B3", "B2"], "min": 0, "max": 3500, "gamma": 1.2}
    else:
        raise ValueError("Camada desconhecida.")
    info = layer.getMapId(vis)
    return {
        "url": info["tile_fetcher"].url_format,
        "mode": mode,
        "year": year,
        "source": DATASET_SENTINEL if mode == "sentinel" else DATASET_HANSEN,
        "expires": "URL temporário emitido pelo Google Earth Engine",
    }

@lru_cache(maxsize=20)
def district_boundary(district: str) -> dict:
    initialize()
    geom = district_geometry(district)
    return {"type": "Feature", "properties": {"district": district},
            "geometry": geom.getInfo()}
