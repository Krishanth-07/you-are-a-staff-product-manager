import { useState } from 'react'
import { getIncidentCommander } from '../api'

export default function IncidentCommanderPanel({ simulation, regionData, onRecommendation, addLog }) {
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
      addLog?.('AI incident commander recommendation generated')
    } catch (err) {
      setError(err.message || 'Unable to generate recommendation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Incident Commander</h2>
        <button
          className="rounded bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!simulation || loading}
          onClick={requestRecommendation}
          type="button"
        >
          {loading ? 'Analyzing...' : 'Get AI Recommendation'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  )
}
