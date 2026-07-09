import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  Polygon,
  Rectangle,
} from "react-leaflet";
import { getRegionData, simulate, simulateEnsemble, getActiveFires } from "../api";

const DEFAULT_PARAMS = {
  ignition_x: 25,
  ignition_y: 25,
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
  time_steps: 6,
};

// Inline SVG strings for Leaflet markers (no react-dom/server dependency)
const POI_ICONS_SVG = {
  village: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  hospital: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>`,
  highway: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/></svg>`,
  cell_tower: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>`,
};

const POI_COLORS = {
  village: "#2563eb",
  hospital: "#dc2626",
  highway: "#78716c",
  cell_tower: "#7c3aed",
};

function gridToLatLng(x, y, bounds) {
  const lat = bounds.south + (y / 49.0) * (bounds.north - bounds.south);
  const lng = bounds.west + (x / 49.0) * (bounds.east - bounds.west);
  return [lat, lng];
}

function latLngToGrid(lat, lng, bounds) {
  const y = Math.round(((lat - bounds.south) / (bounds.north - bounds.south)) * 49.0);
  const x = Math.round(((lng - bounds.west) / (bounds.east - bounds.west)) * 49.0);
  return {
    x: Math.max(0, Math.min(49, x)),
    y: Math.max(0, Math.min(49, y)),
  };
}

function FitBounds({ bounds }) {
  const map = useMap();
  const [fitted, setFitted] = useState(false);

  useEffect(() => {
    if (bounds && !fitted) {
      map.fitBounds([
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ]);
      setFitted(true);
    }
  }, [map, bounds, fitted]);

  return null;
}

function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function poiIcon(type) {
  const color = POI_COLORS[type] || "#78716c";
  const iconMarkup = POI_ICONS_SVG[type] || "";

  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:1.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${iconMarkup}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function ignitionIcon() {
  const iconMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`;

  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;border:1.5px solid #ffffff;box-shadow: 0 2px 8px rgba(0,0,0,0.25);">${iconMarkup}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function FireMap({
  externalParams,
  onSimulationUpdate,
  addLog,
}) {
  const [regionData, setRegionData] = useState(null);
  const [simulationData, setSimulationData] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showFirms, setShowFirms] = useState(false);
  const [firmsData, setFirmsData] = useState([]);
  
  const [showEnsemble, setShowEnsemble] = useState(false);
  const [ensembleData, setEnsembleData] = useState(null);
  const [loadingEnsemble, setLoadingEnsemble] = useState(false);

  const [ignitionX, setIgnitionX] = useState(DEFAULT_PARAMS.ignition_x);
  const [ignitionY, setIgnitionY] = useState(DEFAULT_PARAMS.ignition_y);

  const params = useMemo(
    () => ({
      ...DEFAULT_PARAMS,
      ...(externalParams || {}),
      ignition_x: ignitionX,
      ignition_y: ignitionY,
    }),
    [externalParams, ignitionX, ignitionY],
  );

  useEffect(() => {
    let ignore = false;

    async function runLoad() {
      try {
        setLoading(true);
        const [region, sim] = await Promise.all([
          getRegionData(),
          simulate(params),
        ]);
        if (ignore) return;
        setRegionData(region);
        setSimulationData(sim);
        setStep(0);
        onSimulationUpdate?.(sim, region);
        addLog?.("Simulation updated");
      } catch (err) {
        setError(err.message || "Unable to load region data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    runLoad();
    return () => {
      ignore = true;
    };
  }, [params, onSimulationUpdate, addLog]);

  useEffect(() => {
    if (!playing || !simulationData?.time_steps_data?.length) return undefined;

    const timer = window.setInterval(() => {
      setStep((current) => {
        const next = current + 1;
        if (next >= simulationData.time_steps_data.length) {
          setPlaying(false);
          return current;
        }
        return next;
      });
    }, 800);

    return () => window.clearInterval(timer);
  }, [playing, simulationData]);

  const maxStep = Math.max(
    0,
    (simulationData?.time_steps_data?.length || 1) - 1,
  );
  const currentPolygon =
    simulationData?.time_steps_data?.[Math.min(step, maxStep)] || [];

  const bounds = regionData?.bounds;
  const center = useMemo(() => {
    if (bounds) {
      return [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2];
    }
    return [11.4227, 76.8631];
  }, [bounds]);

  const ignitionPosition = useMemo(() => {
    if (!bounds) return center;
    return gridToLatLng(ignitionX, ignitionY, bounds);
  }, [bounds, ignitionX, ignitionY, center]);

  const handleMapClick = (latlng) => {
    if (!bounds) return;
    const gridCoord = latLngToGrid(latlng.lat, latlng.lng, bounds);
    setIgnitionX(gridCoord.x);
    setIgnitionY(gridCoord.y);
    addLog?.(`Ignition relocated to: X ${gridCoord.x}, Y ${gridCoord.y}`);
  };

  const handleRunEnsemble = async () => {
    if (showEnsemble) {
      setShowEnsemble(false);
      return;
    }
    setLoadingEnsemble(true);
    try {
      const data = await simulateEnsemble(params);
      setEnsembleData(data);
      setShowEnsemble(true);
      addLog?.(`Monte Carlo Ensemble ran with ${data.n_runs} permutations. Mean confidence: ${data.mean_confidence_percent}%`);
    } catch (err) {
      console.error("Ensemble error", err);
    } finally {
      setLoadingEnsemble(false);
    }
  };

  const handleToggleFirms = async () => {
    if (showFirms) {
      setShowFirms(false);
      return;
    }
    try {
      const data = await getActiveFires();
      if (data.error) {
         addLog?.(`FIRMS error: ${data.error}`);
      } else {
         setFirmsData(data);
         setShowFirms(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="command-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Live Fire Map (Kotagiri Region)
            </h2>
            <p className="mt-1 text-xs text-gray-500 font-medium">
              Area affected: ~{simulationData?.total_cells_burnt || 0} m²
            </p>
          </div>
          <div className="flex items-center gap-3">
              <button
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all ${showFirms ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                onClick={handleToggleFirms}
                type="button"
              >
                Live Satellite Hotspots
              </button>
              
              <button
                className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all ${showEnsemble ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                onClick={handleRunEnsemble}
                type="button"
                disabled={loadingEnsemble}
              >
                {loadingEnsemble ? "Running..." : "Run Confidence Analysis"}
              </button>

            <label className="flex items-center gap-3 text-xs text-gray-500">
              <span className="mono shrink-0 font-semibold text-gray-700">
                Step {step + 1} of {maxStep + 1}
              </span>
              <input
                className="w-32 accent-blue-600 cursor-pointer"
                max={maxStep}
                min="0"
                onChange={(event) => setStep(Number(event.target.value))}
                type="range"
                value={step}
              />
            </label>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
              onClick={() => setPlaying((value) => !value)}
              type="button"
            >
              {playing ? "Pause" : "Play Simulation"}
            </button>
          </div>
        </div>

        <div className="relative h-[66vh] min-h-125 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-inner">
          <div className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm backdrop-blur-sm">
            <span style={{ display: 'inline-block', transform: `rotate(${params.wind_direction}deg)` }}>↑</span>
            <span>{params.wind_speed} km/h · {params.wind_direction}°</span>
          </div>
          {loading && (
            <div className="absolute inset-0 z-[1000] grid place-items-center bg-white/80 text-xs font-medium text-gray-500">
              Loading command map...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-[1000] grid place-items-center bg-white text-xs font-semibold text-red-500">
              {error}
            </div>
          )}
          {showFirms && firmsData.length === 0 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/80 text-white px-3 py-1.5 rounded-full text-[10px] font-medium shadow-sm backdrop-blur-sm whitespace-nowrap">
              No active satellite detections in this region as of {new Date().toLocaleTimeString()}
            </div>
          )}
          <MapContainer
            center={center}
            zoom={13}
            className="h-full w-full"
            zoomControl
          >
            {bounds && <FitBounds bounds={bounds} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapEvents onMapClick={handleMapClick} />
            
            {currentPolygon && currentPolygon.length > 0 && !showEnsemble && (
              <Polygon
                positions={currentPolygon}
                pathOptions={{
                  color: "#ef4444",
                  fillColor: "#ef4444",
                  fillOpacity: 0.5,
                  weight: 2,
                  className: "fire-pulse-polygon",
                }}
              />
            )}
            
            {showEnsemble && ensembleData && bounds && ensembleData.contours && (
              <>
                {/* 25% confidence - yellow/orange */}
                {ensembleData.contours["25"]?.map((poly, i) => (
                  <Polygon 
                    key={`25-${i}`} 
                    positions={poly} 
                    pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 1, smoothFactor: 1 }} 
                  />
                ))}
                {/* 50% confidence - orange/red */}
                {ensembleData.contours["50"]?.map((poly, i) => (
                  <Polygon 
                    key={`50-${i}`} 
                    positions={poly} 
                    pathOptions={{ color: '#ea580c', fillColor: '#ea580c', fillOpacity: 0.4, weight: 1.5, smoothFactor: 1 }} 
                  />
                ))}
                {/* 75% confidence - red */}
                {ensembleData.contours["75"]?.map((poly, i) => (
                  <Polygon 
                    key={`75-${i}`} 
                    positions={poly} 
                    pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.6, weight: 2, smoothFactor: 1 }} 
                  />
                ))}
              </>
            )}

            {showFirms && firmsData.map((fire, i) => (
              <Marker 
                key={`firms-${i}`} 
                position={[fire.lat, fire.lng]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:16px;height:16px;border-radius:50%;background:${fire.confidence === 'high' ? '#dc2626' : '#f59e0b'};display:flex;align-items:center;justify-content:center;border:1.5px solid #ffffff;box-shadow:0 0 10px ${fire.confidence === 'high' ? '#dc2626' : '#f59e0b'};"></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
              >
                <Popup>
                   <div className="text-xs text-gray-800">
                     <strong>NASA FIRMS Hotspot</strong><br/>
                     Brightness: {fire.brightness} K<br/>
                     Confidence: {fire.confidence.toUpperCase()}<br/>
                     Acquired: {new Date(fire.acquired_at).toLocaleString()}
                   </div>
                </Popup>
              </Marker>
            ))}
            
            <Marker icon={ignitionIcon()} position={ignitionPosition}>
              <Popup>
                <div className="text-xs text-gray-800">
                  <strong>Ignition Point</strong>
                  <br />
                  Grid Coordinates: X {ignitionX}, Y {ignitionY}
                  <br />
                  Latitude: {ignitionPosition[0].toFixed(5)}
                  <br />
                  Longitude: {ignitionPosition[1].toFixed(5)}
                </div>
              </Popup>
            </Marker>
            
            {regionData?.points_of_interest?.map((poi) => (
              <Marker
                icon={poiIcon(poi.type)}
                key={poi.name}
                position={[poi.lat, poi.lng]}
              >
                <Popup>
                  <div className="text-xs text-gray-800">
                    <strong>{poi.name}</strong>
                    <br />
                    Type: {poi.type.toUpperCase()}
                    <br />
                    Grid: X {poi.x}, Y {poi.y}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
            Actively Burning Area
          </span>
          <span className="flex items-center gap-1.5 text-blue-600 font-medium">
            Carto Voyager Tiles
          </span>
        </div>
      </div>
    </section>
  );
}
