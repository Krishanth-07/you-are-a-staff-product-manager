import { useEffect, useState } from 'react'

const DEFAULTS = {
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
}

export default function WhatIfSliders({ onChange, addLog }) {
  const [values, setValues] = useState(DEFAULTS)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onChange?.(values)
      addLog?.(`What-if simulation requested: wind ${values.wind_speed} km/h, direction ${values.wind_direction}°, humidity ${values.humidity}%`)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [values, onChange, addLog])

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: Number(value) }))
  }

  return (
    <section className="mt-4 rounded border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">What-if Controls</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          <div className="mb-2 flex justify-between">
            <span>Wind Speed</span>
            <strong className="text-white">{values.wind_speed} km/h</strong>
          </div>
          <input className="w-full accent-orange-500" max="100" min="0" onChange={(event) => updateValue('wind_speed', event.target.value)} type="range" value={values.wind_speed} />
        </label>
        <label className="text-sm text-slate-300">
          <div className="mb-2 flex justify-between">
            <span>Wind Direction</span>
            <strong className="text-white">{values.wind_direction}°</strong>
          </div>
          <input className="w-full accent-cyan-400" max="360" min="0" onChange={(event) => updateValue('wind_direction', event.target.value)} type="range" value={values.wind_direction} />
        </label>
        <label className="text-sm text-slate-300">
          <div className="mb-2 flex justify-between">
            <span>Humidity</span>
            <strong className="text-white">{values.humidity}%</strong>
          </div>
          <input className="w-full accent-cyan-400" max="100" min="0" onChange={(event) => updateValue('humidity', event.target.value)} type="range" value={values.humidity} />
        </label>
      </div>
    </section>
  )
}
