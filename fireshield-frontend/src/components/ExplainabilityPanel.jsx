import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function riskColor(score) {
  if (score > 70) return "#dc2626"; // red
  if (score >= 40) return "#d97706"; // amber
  return "#16a34a"; // green
}

function riskLabel(score) {
  if (score > 70) return "High";
  if (score >= 40) return "Elevated";
  return "Moderate";
}

function factorStrength(value, inverse = false) {
  if (typeof value === "number") {
    const score = Math.max(0, Math.min(100, value));
    return inverse ? 100 - score : score;
  }

  const text = String(value || "").toLowerCase();
  if (text.includes("high") || text.includes("steep") || text.includes("dense"))
    return inverse ? 25 : 85;
  if (
    text.includes("medium") ||
    text.includes("moderate") ||
    text.includes("rolling")
  )
    return inverse ? 50 : 55;
  if (
    text.includes("low") ||
    text.includes("gentle") ||
    text.includes("sparse")
  )
    return inverse ? 80 : 20;
  return inverse ? 55 : 45;
}

function AnimatedScore({ score }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 750;
    const animateScore = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(score * progress));
      if (progress < 1) frame = requestAnimationFrame(animateScore);
    };
    frame = requestAnimationFrame(animateScore);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return display;
}

export default function ExplainabilityPanel({ riskFactors, finalRiskScore }) {
  const factors = riskFactors || {};
  const score = finalRiskScore ?? 0;
  const color = riskColor(score);

  const rows = [
    {
      label: "Wind Speed",
      value: `${factors.wind_speed ?? "-"} km/h`,
      strength: factorStrength(factors.wind_speed),
    },
    {
      label: "Humidity Level",
      value: `${factors.humidity ?? "-"}%`,
      strength: factorStrength(factors.humidity, true),
    },
    {
      label: "Vegetation Density",
      value: factors.vegetation_density ?? "-",
      strength: factorStrength(factors.vegetation_density),
    },
    {
      label: "Terrain Type",
      value: factors.terrain ?? "-",
      strength: factorStrength(factors.terrain),
    },
    {
      label: "Settlement Proximity",
      value: factors.nearby_settlements ? "Nearby" : "Clear",
      strength: factors.nearby_settlements ? 92 : 18,
    },
  ];

  // SVG ring math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <section className="command-card p-6">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
            Risk Explainability
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Factor analysis driving the risk assessment model.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
            Risk Posture
          </div>
          <div
            className="mt-0.5 text-sm font-bold"
            style={{ color }}
          >
            {riskLabel(score)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6">
        <div className="relative h-24 w-24 flex items-center justify-center">
          <svg className="absolute h-24 w-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="5"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={color}
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="text-2xl font-bold text-gray-900 leading-none">
            <AnimatedScore score={score} />
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-700">
            Overall Risk Score
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 leading-normal">
            Calculated dynamically from live simulation coordinates and local variables.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-gray-700">
              <span>{row.label}</span>
              <span className="text-gray-500">{row.value}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <motion.div
                animate={{ width: `${row.strength}%` }}
                className="h-2 rounded-full bg-blue-600"
                initial={{ width: 0 }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
