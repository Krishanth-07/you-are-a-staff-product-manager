import { useEffect, useState } from "react";
import { getHistoricalPresets } from "../api";

export default function WhatIfSliders({ values: externalValues, onChange, addLog, usingLiveWeather, onUseLiveWeather }) {
  const [values, setValues] = useState(externalValues);
  const [presets, setPresets] = useState([]);
  const [activePreset, setActivePreset] = useState(null);

  useEffect(() => {
    getHistoricalPresets()
      .then((data) => setPresets(data.presets))
      .catch((err) => console.error("Failed to fetch presets:", err));
  }, []);

  // Sync with external updates (presets, initialization)
  useEffect(() => {
    if (externalValues) {
      setValues(externalValues);
    }
  }, [externalValues]);

  // Debounce updates back to the parent to prevent spamming simulation API
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        values.wind_speed !== externalValues.wind_speed ||
        values.wind_direction !== externalValues.wind_direction ||
        values.humidity !== externalValues.humidity
      ) {
        onChange?.(values);
        addLog?.("Weather parameters updated");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values, onChange, addLog, externalValues]);

  const updateValue = (key, val) => {
    setValues((current) => ({ ...current, [key]: Number(val) }));
    setActivePreset(null);
  };

  const applyPreset = (preset) => {
    const nextVal = {
      wind_speed: preset.wind_speed,
      wind_direction: preset.wind_direction,
      humidity: preset.humidity,
    };
    setValues(nextVal);
    onChange?.(nextVal); // update immediately on preset click
    setActivePreset(preset);
    addLog?.(`Preset applied: ${preset.label}`);
  };

  return (
    <section className="command-card p-6">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
            Scenario Controls
            {usingLiveWeather ? (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 tracking-wider">LIVE</span>
            ) : activePreset ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 tracking-wider">PRESET: {activePreset.label}</span>
            ) : (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-600 tracking-wider">MANUAL</span>
            )}
          </h2>
          <p className="mt-1 text-xs text-gray-500 font-medium">
            Test spread speed by moving sliders, launching a preset, or using live data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onUseLiveWeather();
              setActivePreset(null);
            }}
            className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100 transition-all shadow-sm"
            type="button"
          >
            Use Live Weather
          </button>
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-all shadow-sm ${
                activePreset?.id === preset.id
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100"
              }`}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {activePreset && (
        <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-[10px] text-amber-800 border border-amber-200">
           <div className="font-semibold">{activePreset.description}</div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <label className="text-xs text-gray-600 font-medium">
          <span className="mb-2 block text-gray-700 font-bold">Wind Speed</span>
          <input
            className="w-full accent-blue-600 cursor-pointer"
            max="80"
            min="0"
            onChange={(event) => updateValue("wind_speed", event.target.value)}
            type="range"
            value={values.wind_speed}
          />
        </label>
        <label className="text-xs text-gray-600 font-medium">
          <span className="mb-2 block text-gray-700 font-bold">Wind Direction</span>
          <input
            className="w-full accent-blue-600 cursor-pointer"
            max="360"
            min="0"
            onChange={(event) =>
              updateValue("wind_direction", event.target.value)
            }
            type="range"
            value={values.wind_direction}
          />
        </label>
        <label className="text-xs text-gray-600 font-medium">
          <span className="mb-2 block text-gray-700 font-bold">Humidity</span>
          <input
            className="w-full accent-blue-600 cursor-pointer"
            max="100"
            min="0"
            onChange={(event) => updateValue("humidity", event.target.value)}
            type="range"
            value={values.humidity}
          />
        </label>
      </div>
    </section>
  );
}
