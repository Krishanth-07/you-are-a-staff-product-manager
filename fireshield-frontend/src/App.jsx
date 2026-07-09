import { useCallback, useMemo, useState } from 'react'
import Header from './components/Header'
import AgentPipeline from './components/AgentPipeline'
import FireMap from './components/FireMap'
import WhatIfSliders from './components/WhatIfSliders'
import ExplainabilityPanel from './components/ExplainabilityPanel'
import IncidentCommanderPanel from './components/IncidentCommanderPanel'
import AlertComposer from './components/AlertComposer'
import AskAIPanel from './components/AskAIPanel'
import Timeline from './components/Timeline'

const DEFAULT_SCENARIO = {
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
}

function formatScore(score) {
  if (score == null) return 'Waiting'
  if (score >= 70) return 'High'
  if (score >= 40) return 'Elevated'
  return 'Moderate'
}

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200/10 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{detail}</div>
    </div>
  )
}

export default function App() {
  const [simulation, setSimulation] = useState(null)
  const [regionData, setRegionData] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [sliderParams, setSliderParams] = useState(DEFAULT_SCENARIO)
  const [logs, setLogs] = useState([])

  const addLog = useCallback((message) => {
    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        message,
        time: new Date().toLocaleTimeString(),
      },
      ...current,
    ])
  }, [])

  const handleSimulationUpdate = useCallback((nextSimulation, nextRegion) => {
    setSimulation(nextSimulation)
    if (nextRegion) setRegionData(nextRegion)
  }, [])

  const summary = useMemo(() => {
    const riskScore = simulation?.final_risk_score ?? null
    const burnt = simulation?.total_cells_burnt ?? 0
    const confidence = recommendation?.confidence_percent ?? null
    const containment = recommendation?.containment_estimate_percent ?? null
    const evacuationTarget = recommendation?.evacuate?.[0]?.location ?? 'Awaiting plan'

    return {
      posture: formatScore(riskScore),
      cards: [
        {
          label: 'Risk posture',
          value: riskScore == null ? '—' : riskScore,
          detail: riskScore == null ? 'Run the model to generate a score.' : 'Latest simulation output from the spread model.',
        },
        {
          label: 'Burned area',
          value: burnt,
          detail: 'Cells affected in the latest time step.',
        },
        {
          label: 'Command confidence',
          value: confidence == null ? '—' : `${confidence}%`,
          detail: confidence == null ? 'Generate a recommendation to see confidence.' : 'Incident commander recommendation strength.',
        },
        {
          label: 'Primary action',
          value: recommendation ? evacuationTarget : 'Awaiting plan',
          detail: containment == null ? 'Generate a command plan to see the containment estimate.' : `Containment estimate ${containment}%`,
        },
      ],
    }
  }, [recommendation, simulation])

  return (
    <div className="min-h-screen text-slate-100">
      <Header />
      <AgentPipeline />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="command-card p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Operational summary</div>
              <h2 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Nilgiris wildfire response workspace</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                A practical command view for planning response, updating evacuation guidance, and keeping the model, map,
                and public messaging aligned in one place.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/10 bg-slate-950/55 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Current posture</div>
              <div className="mt-2 text-xl font-semibold text-slate-50">{summary.posture}</div>
              <div className="mt-1 text-sm text-slate-400">{simulation ? 'Latest simulation is loaded.' : 'Waiting for the model to initialize.'}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.cards.map((card) => (
              <StatCard detail={card.detail} key={card.label} label={card.label} value={card.value} />
            ))}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.36fr)_minmax(360px,0.74fr)] xl:items-start">
          <div className="space-y-5">
            <FireMap addLog={addLog} externalParams={sliderParams} onSimulationUpdate={handleSimulationUpdate} />
            <WhatIfSliders addLog={addLog} onChange={setSliderParams} />
          </div>

          <aside className="command-scroll flex max-h-[calc(100vh-178px)] flex-col gap-4 overflow-y-auto pr-1">
            <ExplainabilityPanel finalRiskScore={simulation?.final_risk_score} riskFactors={simulation?.risk_factors} />
            <IncidentCommanderPanel
              addLog={addLog}
              onRecommendation={setRecommendation}
              recommendation={recommendation}
              regionData={regionData}
              simulation={simulation}
            />
            <AlertComposer addLog={addLog} recommendation={recommendation} />
            <AskAIPanel addLog={addLog} recommendation={recommendation} simulation={simulation} />
            <Timeline logs={logs} />
          </aside>
        </section>
      </main>
    </div>
  )
}
