import { useEffect, useState } from "react";

const PRESETS = [
  { name: "Extreme Gale", wind_speed: 65, wind_direction: 120, humidity: 12 },
  { name: "Moderate Dry", wind_speed: 25, wind_direction: 90, humidity: 35 },
  { name: "Monsoon Wet", wind_speed: 10, wind_direction: 45, humidity: 82 },
];

export default function WhatIfSliders({ values: externalValues, onChange, addLog, usingLiveWeather, onUseLiveWeather }) {
  const [values, setValues] = useState(externalValues);

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
  };

  const applyPreset = (preset) => {
    const nextVal = {
      wind_speed: preset.wind_speed,
      wind_direction: preset.wind_direction,
      humidity: preset.humidity,
    };
    setValues(nextVal);
    onChange?.(nextVal); // update immediately on preset click
    addLog?.(`Preset applied: ${preset.name}`);
  };

  return (
    <section className="command-card p-6">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
            Scenario Controls
            {usingLiveWeather ? (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700 tracking-wider">LIVE</span>
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
            onClick={onUseLiveWeather}
            className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100 transition-all shadow-sm"
            type="button"
          >
            Use Live Weather
          </button>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 transition-all shadow-sm"
              type="button"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

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
