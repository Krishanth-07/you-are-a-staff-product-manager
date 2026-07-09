import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function riskColor(score) {
  if (score > 70) return "#ef4444";
  if (score >= 40) return "#f97316";
  return "#10b981";
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
      label: "Wind",
      value: `${factors.wind_speed ?? "-"} km/h`,
      strength: factorStrength(factors.wind_speed),
    },
    {
      label: "Humidity",
      value: `${factors.humidity ?? "-"}%`,
      strength: factorStrength(factors.humidity, true),
    },
    {
      label: "Vegetation",
      value: factors.vegetation_density ?? "-",
      strength: factorStrength(factors.vegetation_density),
    },
    {
      label: "Terrain",
      value: factors.terrain ?? "-",
      strength: factorStrength(factors.terrain),
    },
    {
      label: "Settlements",
      value: factors.nearby_settlements ? "Nearby" : "Clear",
      strength: factors.nearby_settlements ? 92 : 18,
    },
  ];

  return (
    <section className="command-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
            Risk explainability
          </div>
          <div className="mt-2 text-sm text-slate-400">
            Model score and the factors driving it.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Risk posture
          </div>
          <div
            className="mt-1 text-lg font-semibold text-slate-50"
            style={{ color }}
          >
            {riskLabel(score)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-24 w-24 rounded-3xl border border-slate-200/10 bg-slate-950/55">
          <div
            className="mono absolute inset-0 grid place-items-center text-3xl font-semibold"
            style={{ color }}
          >
            <AnimatedScore score={score} />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Final risk score
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Latest spread model output.
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-200">{row.label}</span>
              <span className="text-slate-400">{row.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-900">
              <motion.div
                animate={{ width: `${row.strength}%` }}
                className="h-2 rounded-full bg-cyan-400"
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
