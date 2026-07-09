import { useEffect, useState } from "react";

const DEFAULTS = {
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
};

export default function WhatIfSliders({ onChange, addLog }) {
  const [values, setValues] = useState(DEFAULTS);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onChange?.(values);
      addLog?.("What-if settings updated");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values, onChange, addLog]);

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <section className="command-card mt-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-200/8 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-200">
            Scenario controls
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Adjust the weather inputs that drive the spread model.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-slate-200/10 bg-slate-950/55 px-3 py-1">
            Wind {values.wind_speed} km/h
          </span>
          <span className="rounded-full border border-slate-200/10 bg-slate-950/55 px-3 py-1">
            Direction {values.wind_direction}°
          </span>
          <span className="rounded-full border border-slate-200/10 bg-slate-950/55 px-3 py-1">
            Humidity {values.humidity}%
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-slate-100">Wind speed</span>
          <input
            className="w-full accent-cyan-400"
            max="100"
            min="0"
            onChange={(event) => updateValue("wind_speed", event.target.value)}
            type="range"
            value={values.wind_speed}
          />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-slate-100">Wind direction</span>
          <input
            className="w-full accent-cyan-400"
            max="360"
            min="0"
            onChange={(event) =>
              updateValue("wind_direction", event.target.value)
            }
            type="range"
            value={values.wind_direction}
          />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-2 block text-slate-100">Humidity</span>
          <input
            className="w-full accent-cyan-400"
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
