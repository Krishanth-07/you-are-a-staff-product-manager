import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { getIncidentCommander } from '../api'

export default function IncidentCommanderPanel({ simulation, regionData, onRecommendation, recommendation, addLog }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const requestRecommendation = async () => {
    if (!simulation) return
    setLoading(true)
    setError('')
    try {
      const response = await getIncidentCommander({
        risk_score: simulation.final_risk_score,
        risk_factors: simulation.risk_factors,
        total_cells_burnt: simulation.total_cells_burnt,
        points_of_interest: regionData?.points_of_interest || [],
        ignition_x: 25,
        ignition_y: 25,
      })
      onRecommendation?.(response)
      addLog?.('Incident commander recommendation generated')
    } catch (err) {
      setError(err.message || 'Unable to generate recommendation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="command-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Incident commander</h2>
          <p className="mt-1 text-sm text-slate-400">Generate a concise response plan from the latest model state.</p>
        </div>
        <button
          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!simulation || loading}
          onClick={requestRecommendation}
          type="button"
        >
          {loading ? 'Analyzing...' : 'Get AI Recommendation'}
        </button>
      </div>
      {!recommendation && !loading && (
        <div className="mt-4 grid place-items-center rounded-2xl border border-slate-200/10 bg-slate-950/55 px-4 py-7 text-center">
          <ShieldAlert className="text-slate-600" size={48} />
          <p className="mt-3 max-w-xs text-sm text-slate-400">Run the recommendation engine to produce evacuation, resource, and protection actions.</p>
        </div>
      )}
      {recommendation && (
        <div className="mt-4 space-y-4 text-sm text-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-orange-300">Evacuation</div>
              <div className="mt-3 space-y-2">
                {recommendation.evacuate.map((item) => (
                  <div key={item.location}>
                    <div className="font-medium text-slate-100">{item.location}</div>
                    <div className="text-xs text-slate-400">ETA {item.time_minutes} min · {item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Resources</div>
              <div className="mt-3 space-y-2">
                {recommendation.deploy_resources.map((item, index) => (
                  <div key={`${item.type}-${index}`}>
                    <div className="font-medium text-slate-100">{item.count} {item.type}</div>
                    <div className="text-xs text-slate-400">Deploy from {item.from}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Road closures</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendation.road_closures.map((item) => (
                <span className="rounded-full border border-slate-200/10 bg-slate-900/70 px-3 py-1 text-xs text-slate-200" key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Priority protect</div>
            <div className="mt-3 space-y-2">
              {recommendation.priority_protect.map((item) => (
                <div key={item.location}>
                  <div className="font-medium text-slate-100">{item.location}</div>
                  <div className="text-xs text-slate-400">{item.reason}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Confidence</span>
                <span className="mono">{recommendation.confidence_percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${recommendation.confidence_percent}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>Containment estimate</span>
                <span className="mono">{recommendation.containment_estimate_percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div className="h-2 rounded-full bg-orange-400" style={{ width: `${recommendation.containment_estimate_percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
      {loading && <p className="mt-4 text-sm text-slate-400">Running incident analysis...</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  )
}
