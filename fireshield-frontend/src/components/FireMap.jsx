import { useEffect, useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { Cross, Home, Navigation, Radio, Route } from "lucide-react";
import { getRegionData, simulate } from "../api";

const DEFAULT_PARAMS = {
  ignition_x: 25,
  ignition_y: 25,
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
  time_steps: 6,
};

const MAP_BOUNDS = [
  [0, 0],
  [50, 50],
];

const TERRAIN_CANVAS_SIZE = 1000;

const POI_STYLE = {
  village: { Icon: Home, color: "#06b6d4" },
  hospital: { Icon: Cross, color: "#ef4444" },
  highway: { Icon: Route, color: "#64748b" },
  cell_tower: { Icon: Radio, color: "#64748b" },
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(start, end, t) {
  return [
    lerp(start[0], end[0], t),
    lerp(start[1], end[1], t),
    lerp(start[2], end[2], t),
  ];
}

function colorToCss([red, green, blue], alpha = 1) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildTerrainUrl(regionData) {
  const canvas = document.createElement("canvas");
  canvas.width = TERRAIN_CANVAS_SIZE;
  canvas.height = TERRAIN_CANVAS_SIZE;
  const context = canvas.getContext("2d");

  if (!context) return "";

  const cellSize = TERRAIN_CANVAS_SIZE / regionData.grid_size;

  for (let y = 0; y < regionData.grid_size; y += 1) {
    for (let x = 0; x < regionData.grid_size; x += 1) {
      const vegetation = regionData.vegetation_map[y][x];
      const elevation = regionData.elevation_map[y][x];
      const canopyMix = Math.max(
        0,
        Math.min(1, vegetation * 0.72 + (1 - elevation) * 0.28),
      );
      const ridgeMix = Math.max(
        0,
        Math.min(1, elevation * 0.85 + vegetation * 0.15),
      );
      const lowland = lerpColor([18, 62, 42], [31, 92, 58], canopyMix);
      const ridge = lerpColor([84, 110, 62], [132, 108, 76], ridgeMix);
      const gradient = context.createLinearGradient(
        x * cellSize,
        y * cellSize,
        (x + 1) * cellSize,
        (y + 1) * cellSize,
      );
      gradient.addColorStop(0, colorToCss(lowland));
      gradient.addColorStop(1, colorToCss(ridge));
      context.fillStyle = gradient;
      context.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
    }
  }

  for (let y = 0; y < regionData.grid_size; y += 1) {
    for (let x = 0; x < regionData.grid_size; x += 1) {
      const elevation = regionData.elevation_map[y][x];
      const left = regionData.elevation_map[y][Math.max(0, x - 1)];
      const right =
        regionData.elevation_map[y][Math.min(regionData.grid_size - 1, x + 1)];
      const up = regionData.elevation_map[Math.max(0, y - 1)][x];
      const down =
        regionData.elevation_map[Math.min(regionData.grid_size - 1, y + 1)][x];
      const slope = (right - left + (down - up)) * 0.55;
      const shade = Math.max(
        -0.18,
        Math.min(0.18, slope - (elevation - 0.5) * 0.04),
      );

      context.fillStyle =
        shade > 0
          ? `rgba(255,255,255,${shade})`
          : `rgba(0,0,0,${Math.abs(shade)})`;
      context.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
    }
  }

  context.globalAlpha = 0.14;
  for (let y = 0; y < regionData.grid_size; y += 1) {
    for (let x = 0; x < regionData.grid_size; x += 1) {
      const seed = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453;
      const noise = seed - Math.floor(seed);
      if (noise < 0.82) continue;
      context.fillStyle =
        noise > 0.93 ? "rgba(255, 255, 255, 0.22)" : "rgba(12, 74, 110, 0.16)";
      const size = cellSize * (0.12 + noise * 0.22);
      context.beginPath();
      context.arc(
        x * cellSize + cellSize * 0.55,
        y * cellSize + cellSize * 0.45,
        size,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  return canvas.toDataURL("image/png");
}

function buildFireUrl(regionData, simulation, step) {
  const canvas = document.createElement("canvas");
  canvas.width = TERRAIN_CANVAS_SIZE;
  canvas.height = TERRAIN_CANVAS_SIZE;
  const context = canvas.getContext("2d");

  if (!context || !simulation?.time_steps_data?.length) return "";

  const cellSize = TERRAIN_CANVAS_SIZE / regionData.grid_size;
  const cells =
    simulation.time_steps_data[
      Math.min(step, simulation.time_steps_data.length - 1)
    ] || [];
  const statusByKey = new Map(
    cells.map((cell) => [`${cell.x}:${cell.y}`, cell.status]),
  );

  for (let y = 0; y < regionData.grid_size; y += 1) {
    for (let x = 0; x < regionData.grid_size; x += 1) {
      const status = statusByKey.get(`${x}:${y}`);
      if (status === "burning") {
        const centerX = x * cellSize + cellSize / 2;
        const centerY = y * cellSize + cellSize / 2;
        const gradient = context.createRadialGradient(
          centerX,
          centerY,
          cellSize * 0.12,
          centerX,
          centerY,
          cellSize * 0.9,
        );
        gradient.addColorStop(0, "rgba(255, 237, 213, 0.95)");
        gradient.addColorStop(0.2, "rgba(249, 115, 22, 0.88)");
        gradient.addColorStop(0.55, "rgba(220, 38, 38, 0.72)");
        gradient.addColorStop(1, "rgba(220, 38, 38, 0)");
        context.fillStyle = gradient;
        context.fillRect(
          x * cellSize - cellSize * 0.2,
          y * cellSize - cellSize * 0.2,
          cellSize * 1.4,
          cellSize * 1.4,
        );
      } else if (status === "burnt") {
        context.fillStyle = "rgba(17, 24, 39, 0.78)";
        context.fillRect(
          x * cellSize,
          y * cellSize,
          cellSize + 1,
          cellSize + 1,
        );
      }
    }
  }

  return canvas.toDataURL("image/png");
}

function TerrainOverlay({ terrainUrl, fireUrl }) {
  if (!terrainUrl) return null;

  return (
    <>
      <ImageOverlay bounds={MAP_BOUNDS} opacity={1} url={terrainUrl} />
      {fireUrl && (
        <ImageOverlay bounds={MAP_BOUNDS} opacity={0.92} url={fireUrl} />
      )}
    </>
  );
}

function FitBounds() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(MAP_BOUNDS);
  }, [map]);

  return null;
}

function poiIcon(type) {
  const style = POI_STYLE[type] || { Icon: Radio, color: "#64748b" };
  const iconMarkup = renderToStaticMarkup(
    <style.Icon color="white" size={15} strokeWidth={2.25} />,
  );

  return L.divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:999px;background:${style.color};display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.85);box-shadow:0 0 0 6px color-mix(in srgb, ${style.color} 16%, transparent)">${iconMarkup}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function ignitionIcon() {
  const iconMarkup = renderToStaticMarkup(
    <Navigation color="white" size={14} strokeWidth={2.5} />,
  );

  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:999px;background:linear-gradient(180deg,#f97316,#dc2626);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.9);box-shadow:0 0 0 8px rgba(249,115,22,.18),0 0 24px rgba(249,115,22,.45)">${iconMarkup}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
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

  const params = useMemo(
    () => ({ ...DEFAULT_PARAMS, ...(externalParams || {}) }),
    [externalParams],
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
  const currentCells =
    simulationData?.time_steps_data?.[Math.min(step, maxStep)] || [];
  const affectedCells = currentCells.filter(
    (cell) => cell.status === "burning" || cell.status === "burnt",
  ).length;
  const ignitionPosition = [params.ignition_y + 0.5, params.ignition_x + 0.5];
  const terrainUrl = useMemo(
    () => (regionData ? buildTerrainUrl(regionData) : ""),
    [regionData],
  );
  const fireUrl = useMemo(
    () =>
      regionData && simulationData
        ? buildFireUrl(regionData, simulationData, step)
        : "",
    [regionData, simulationData, step],
  );

  return (
    <section className="command-card overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              Live Fire Map
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Area affected: {affectedCells} cells (~{affectedCells * 4} ha)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"
              onClick={() => setPlaying((value) => !value)}
              type="button"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <label className="flex items-center gap-3 text-xs text-slate-400">
              <span className="mono shrink-0 text-slate-100">
                Step {step + 1}/{maxStep + 1}
              </span>
              <input
                className="w-40 accent-cyan-400"
                max={maxStep}
                min="0"
                onChange={(event) => setStep(Number(event.target.value))}
                type="range"
                value={step}
              />
            </label>
          </div>
        </div>

        <div className="relative h-[66vh] min-h-125 overflow-hidden rounded-[28px] border border-white/8 bg-slate-950">
          <div className="absolute right-4 top-4 z-20 text-[11px] text-slate-300">
            {params.wind_direction}° · {params.wind_speed} km/h
          </div>
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/90 text-slate-300">
              Loading command map...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950 text-red-300">
              {error}
            </div>
          )}
          <MapContainer
            bounds={MAP_BOUNDS}
            className="h-full w-full"
            crs={L.CRS.Simple}
            maxBounds={[
              [-5, -5],
              [55, 55],
            ]}
            maxZoom={4}
            minZoom={-2}
            zoom={1}
            zoomControl
          >
            <FitBounds />
            <TerrainOverlay fireUrl={fireUrl} terrainUrl={terrainUrl} />
            <Marker icon={ignitionIcon()} position={ignitionPosition}>
              <Popup>
                <strong>Ignition point</strong>
                <br />X {params.ignition_x}, Y {params.ignition_y}
              </Popup>
            </Marker>
            {regionData?.points_of_interest?.map((poi) => (
              <Marker
                icon={poiIcon(poi.type)}
                key={poi.name}
                position={[poi.y + 0.5, poi.x + 0.5]}
              >
                <Popup>
                  <strong>{poi.name}</strong>
                  <br />
                  {poi.type}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#365c3d]" />
            Terrain
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            Fire
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1a1210]" />
            Burnt
          </span>
        </div>
      </div>
    </section>
  );
}
