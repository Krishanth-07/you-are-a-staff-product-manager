import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { generateIncidentReport } from '../api'

function compactSimulation(simulation) {
  if (!simulation) return null
  return {
    grid_size: simulation.grid_size,
    final_risk_score: simulation.final_risk_score,
    risk_factors: simulation.risk_factors,
    total_cells_burnt: simulation.total_cells_burnt,
  }
}

export default function IncidentReportPanel({ simulation, recommendation, logs, addLog }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const logStrings = useMemo(() => logs.map((log) => `${log.time} - ${log.message}`), [logs])

  const generateReport = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await generateIncidentReport(
        compactSimulation(simulation),
        recommendation || {},
        logStrings,
      )
      setReport(response)
      addLog?.('Official incident report generated')
    } catch (err) {
      setError(err.message || 'Unable to generate incident report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="command-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Incident Report</h2>
        <button
          className="rounded bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !simulation}
          onClick={generateReport}
          type="button"
        >
          {loading ? 'Drafting...' : 'Generate Official Report'}
        </button>
      </div>
      {!report && (
        <div className="mt-5 grid place-items-center rounded border border-slate-800 bg-slate-900/45 px-4 py-7 text-center">
          <FileText className="text-slate-600" size={48} />
          <p className="mt-3 text-sm text-slate-400">Report package pending command approval.</p>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {report && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="incident-report-print serif-report mt-4 rounded bg-[#fff8e7] p-5 text-slate-950 shadow-2xl"
          initial={{ opacity: 0, y: 18 }}
        >
          <div className="border-2 border-slate-900 p-4 text-center">
            <div className="text-xs font-bold tracking-wide">GOVERNMENT OF TAMIL NADU - FOREST DEPARTMENT - INCIDENT REPORT</div>
            <div className="mono mt-2 text-2xl font-black">{report.incident_id}</div>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="font-bold uppercase">Summary</h3>
              <p>{report.summary}</p>
            </section>
            <section>
              <h3 className="font-bold uppercase">Timeline Narrative</h3>
              <p className="whitespace-pre-line">{report.timeline_narrative}</p>
            </section>
            <section>
              <h3 className="font-bold uppercase">Actions Taken</h3>
              <ul className="list-disc pl-5">
                {report.actions_taken.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h3 className="font-bold uppercase">Resources Deployed</h3>
              <p>{report.resources_deployed}</p>
            </section>
            <section>
              <h3 className="font-bold uppercase">Population Impact</h3>
              <p>{report.population_impact}</p>
            </section>
            <section>
              <h3 className="font-bold uppercase">Recommendation</h3>
              <p>{report.recommendation}</p>
            </section>
          </div>
          <button className="no-print mt-5 rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => window.print()} type="button">
            Print / Export PDF
          </button>
        </motion.div>
      )}
    </section>
  )
}
