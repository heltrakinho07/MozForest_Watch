import { useEffect, useRef, useState } from "react";
export default function ForestMap3D({ boundary, tile }) {
  const holder = useRef(null);
  const viewerRef = useRef(null);
  const cesiumRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let viewer;
    async function init() {
      try {
        const Cesium = await import("cesium");
        await import("cesium/Build/Cesium/Widgets/widgets.css");
        if (disposed) return;
        cesiumRef.current = Cesium;
        const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
        if (token) Cesium.Ion.defaultAccessToken = token;
        viewer = new Cesium.Viewer(holder.current, {
          baseLayer: new Cesium.ImageryLayer(new Cesium.OpenStreetMapImageryProvider({
            url: "https://tile.openstreetmap.org/"
          })),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          animation: false, timeline: false, baseLayerPicker: false,
          homeButton: false, geocoder: false, sceneModePicker: false,
          navigationHelpButton: false, fullscreenButton: false,
          infoBox: false, selectionIndicator: false
        });
        viewerRef.current = viewer;
        setReady(true);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(37.5, -16.5, 850000)
        });
      } catch (e) { if (!disposed) setError("Não foi possível iniciar o visualizador 3D: " + e.message); }
    }
    init();
    return () => {
      disposed = true;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const viewer = viewerRef.current, Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    let cancelled = false;
    let overlay, boundaryData;
    async function add() {
      try {
        if (tile?.url) {
          overlay = viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
            url: tile.url, maximumLevel: 19, credit: "Hansen / Google Earth Engine"
          }));
          overlay.alpha = tile.mode === "sentinel" ? 1 : .85;
        }
        if (boundary) {
          boundaryData = await Cesium.GeoJsonDataSource.load(boundary, {
            stroke: Cesium.Color.fromCssColorString("#C2FF85"), strokeWidth: 3,
            fill: Cesium.Color.TRANSPARENT, clampToGround: true,
          });
          if (!cancelled) {
            await viewer.dataSources.add(boundaryData);
            viewer.zoomTo(boundaryData);
          }
        }
      } catch (e) { if (!cancelled) setError("Não foi possível adicionar a camada 3D: " + e.message); }
    }
    add();
    return () => {
      cancelled = true;
      if (overlay && !viewer.isDestroyed()) viewer.imageryLayers.remove(overlay, true);
      if (boundaryData && !viewer.isDestroyed()) viewer.dataSources.remove(boundaryData, true);
    };
  }, [tile, boundary, ready]);
  return <div className="map-slot"><div ref={holder} className="map-canvas"/>{error && <div className="map-warning">{error}</div>}
    <div className="map-footnote">Globo 3D · superfície elipsoidal (sem relevo do terreno)</div></div>;
}
