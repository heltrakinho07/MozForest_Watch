import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

function rasterStyle(base) {
  const satellite = base === "satellite";
  const tiles = satellite
    ? ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"]
    : ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
  return {
    version: 8,
    sources: {
      background: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution: satellite ? "Esri, Maxar, Earthstar Geographics" : "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "base", type: "raster", source: "background" }],
  };
}
function zoomToFeature(map, feature) {
  if (!feature || !feature.geometry) return;
  const coordinates = [];
  function visit(value) {
    if (typeof value?.[0] === "number") coordinates.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
  }
  visit(feature.geometry.coordinates);
  if (!coordinates.length) return;
  const bounds = coordinates.reduce(
    (acc, point) => acc.extend(point),
    new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
  );
  map.fitBounds(bounds, { padding: 55, maxZoom: 11, duration: 800 });
}
export default function ForestMap2D({ boundary, tile, base = "satellite", label, compact = false }) {
  const holder = useRef(null);
  const map = useRef(null);
  useEffect(() => {
    if (!holder.current) return;
    const instance = new maplibregl.Map({
      container: holder.current,
      style: rasterStyle(base),
      center: [37.5, -16.5], zoom: 6,
      attributionControl: true, pitchWithRotate: false
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    return () => { instance.remove(); map.current = null; };
  }, [base]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const update = () => {
      if (instance.getLayer("forest-layer")) instance.removeLayer("forest-layer");
      if (instance.getSource("forest-source")) instance.removeSource("forest-source");
      if (instance.getLayer("boundary-line")) instance.removeLayer("boundary-line");
      if (instance.getLayer("boundary-fill")) instance.removeLayer("boundary-fill");
      if (instance.getSource("boundary")) instance.removeSource("boundary");
      if (tile?.url) {
        instance.addSource("forest-source", {
          type: "raster", tiles: [tile.url], tileSize: 256, attribution: "Hansen / Google Earth Engine"
        });
        instance.addLayer({
          id: "forest-layer", type: "raster", source: "forest-source",
          paint: { "raster-opacity": tile.mode === "sentinel" ? 1 : .83, "raster-fade-duration": 0 }
        });
      }
      if (boundary) {
        instance.addSource("boundary", { type: "geojson", data: boundary });
        instance.addLayer({
          id: "boundary-fill", type: "fill", source: "boundary",
          paint: { "fill-color": "#72EFAC", "fill-opacity": .04 }
        });
        instance.addLayer({
          id: "boundary-line", type: "line", source: "boundary",
          paint: { "line-color": "#C2FF85", "line-width": 2, "line-dasharray": [2, 1] }
        });
        zoomToFeature(instance, boundary);
      }
    };
    if (instance.isStyleLoaded()) update();
    else instance.once("load", update);
    return () => { instance.off("load", update); };
  }, [boundary, tile, base]);
  return <div className={"map-slot " + (compact ? "compact" : "")}>
    <div ref={holder} className="map-canvas"/>
    {label && <span className="map-year-tag">{label}</span>}
    <div className="map-footnote">{tile ? "Dados de satélite processados · Earth Engine" : "Mapa base · à espera de dados Earth Engine"}</div>
  </div>;
}
