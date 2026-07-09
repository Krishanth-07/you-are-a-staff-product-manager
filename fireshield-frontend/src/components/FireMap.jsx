import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import { getRegionData, simulate } from '../api'

const DEFAULT_PARAMS = {
  ignition_x: 25,
  ignition_y: 25,
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
  time_steps: 6,
}

const poiStyle = {
  village: { icon: 'H', color: '#06b6d4' },
  hospital: { icon: '+', color: '#ef4444' },
  highway: { icon: 'R', color: '#f97316' },
  cell_tower: { icon: 'T', color: '#a78bfa' },
}

function cellColor(status, vegetation) {
  if (status === 'burning') return '#f97316'
  if (status === 'burnt') return '#2f3544'
  const green = Math.round(70 + vegetation * 120)
  return `rgb(18, ${green}, ${Math.round(50 + vegetation * 35)})`
}

function GridLayer({ regionData, simulation, step }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!regionData || !simulation?.time_steps_data?.length) return undefined

    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map)
    }
    const layer = layerRef.current
    layer.clearLayers()

    const cells = simulation.time_steps_data[Math.min(step, simulation.time_steps_data.length - 1)] || []
    const statusByKey = new Map(cells.map((cell) => [`${cell.x}:${cell.y}`, cell.status]))

    for (let y = 0; y < regionData.grid_size; y += 1) {
      for (let x = 0; x < regionData.grid_size; x += 1) {
        const status = statusByKey.get(`${x}:${y}`) || 'unburnt'
        L.rectangle(
          [
            [y, x],
            [y + 1, x + 1],
          ],
          {
            stroke: false,
            fillColor: cellColor(status, regionData.vegetation_map[y][x]),
            fillOpacity: status === 'burning' ? 0.96 : 0.78,
          },
        ).addTo(layer)
      }
    }

    return undefined
  }, [map, regionData, simulation, step])

  return null
}

function FitBounds() {
  const map = useMap()
  useEffect(() => {
    map.fitBounds([
      [0, 0],
      [50, 50],
    ])
  }, [map])
  return null
}

function poiIcon(type) {
  const style = poiStyle[type] || { icon: 'P', color: '#e5e7eb' }
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:999px;background:${style.color};color:#050814;display:flex;align-items:center;justify-content:center;font-weight:900;border:2px solid white;box-shadow:0 8px 22px rgba(0,0,0,.45)">${style.icon}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function FireMap({ externalParams, onSimulationUpdate, addLog }) {
  const [regionData, setRegionData] = useState(null)
  const [simulationData, setSimulationData] = useState(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(() => ({ ...DEFAULT_PARAMS, ...(externalParams || {}) }), [externalParams])

  useEffect(() => {
    let ignore = false
    async function runLoad() {
      try {
        setLoading(true)
        const [region, sim] = await Promise.all([getRegionData(), simulate(params)])
        if (ignore) return
        setRegionData(region)
        setSimulationData(sim)
        setStep(0)
        onSimulationUpdate?.(sim, region)
        addLog?.(`Simulation run: wind ${params.wind_speed} km/h, humidity ${params.humidity}%`)
      } catch (err) {
        setError(err.message || 'Unable to load region data')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    runLoad()
    return () => {
      ignore = true
    }
  }, [params, onSimulationUpdate, addLog])

  useEffect(() => {
    if (!playing || !simulationData?.time_steps_data?.length) return undefined
    const timer = window.setInterval(() => {
      setStep((current) => {
        const next = current + 1
        if (next >= simulationData.time_steps_data.length) {
          setPlaying(false)
          return current
        }
        return next
      })
    }, 800)
    return () => window.clearInterval(timer)
  }, [playing, simulationData])

  const maxStep = Math.max(0, (simulationData?.time_steps_data?.length || 1) - 1)

  return (
    <section className="overflow-hidden rounded border border-slate-800 bg-slate-950/80">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Live Fire Map</h2>
          <p className="text-xs text-slate-400">Synthetic 50x50 operational grid, CRS.Simple</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            onClick={() => setPlaying((value) => !value)}
            type="button"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Step {step + 1}/{maxStep + 1}
            <input
              className="accent-orange-500"
              max={maxStep}
              min="0"
              onChange={(event) => setStep(Number(event.target.value))}
              type="range"
              value={step}
            />
          </label>
        </div>
      </div>

      <div className="relative h-[58vh] min-h-[420px]">
        {loading && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950/80 text-cyan-200">Loading command map...</div>}
        {error && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950 text-red-300">{error}</div>}
        <div className="absolute right-4 top-4 z-[450] rounded border border-cyan-500/40 bg-slate-950/90 px-3 py-2 text-xs text-slate-200">
          <div className="font-semibold text-cyan-300">Wind</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block text-xl text-orange-400" style={{ transform: `rotate(${params.wind_direction}deg)` }}>
              ↑
            </span>
            <span>{params.wind_direction}° / {params.wind_speed} km/h</span>
          </div>
        </div>
        <MapContainer
          bounds={[
            [0, 0],
            [50, 50],
          ]}
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
          <GridLayer regionData={regionData} simulation={simulationData} step={step} />
          {regionData?.points_of_interest?.map((poi) => (
            <Marker icon={poiIcon(poi.type)} key={poi.name} position={[poi.y + 0.5, poi.x + 0.5]}>
              <Popup>
                <strong>{poi.name}</strong>
                <br />
                {poi.type}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  )
}
