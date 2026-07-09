function riskColor(score) {
  if (score > 70) return 'text-red-300 border-red-500/40 bg-red-500/10'
  if (score >= 40) return 'text-orange-300 border-orange-500/40 bg-orange-500/10'
  return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
}

export default function ExplainabilityPanel({ riskFactors, finalRiskScore }) {
  const factors = riskFactors || {}
  const score = finalRiskScore ?? 0

  return (
    <section className="rounded border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Risk Explainability</h2>
      <div className={`mt-4 rounded border p-4 ${riskColor(score)}`}>
        <div className="text-xs uppercase tracking-wide">Final Risk Score</div>
        <div className="mt-1 text-5xl font-black">{score}</div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        <li>✓ Wind: {factors.wind_speed ?? '-'} km/h</li>
        <li>✓ Humidity: {factors.humidity ?? '-'}%</li>
        <li>✓ Vegetation: {factors.vegetation_density ?? '-'}</li>
        <li>✓ Terrain: {factors.terrain ?? '-'}</li>
        <li>✓ Nearby settlements: {factors.nearby_settlements ? 'yes' : 'no'}</li>
      </ul>
    </section>
  )
}
