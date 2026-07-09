import { useCallback, useState } from 'react'
import Header from './components/Header'
import FireMap from './components/FireMap'
import WhatIfSliders from './components/WhatIfSliders'
import ExplainabilityPanel from './components/ExplainabilityPanel'
import IncidentCommanderPanel from './components/IncidentCommanderPanel'
import AlertComposer from './components/AlertComposer'
import AskAIPanel from './components/AskAIPanel'
import Timeline from './components/Timeline'

export default function App() {
  const [simulation, setSimulation] = useState(null)
  const [regionData, setRegionData] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [sliderParams, setSliderParams] = useState(null)
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

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      <Header />
      <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,65fr)_minmax(360px,35fr)]">
        <div>
          <FireMap
            addLog={addLog}
            externalParams={sliderParams}
            onSimulationUpdate={handleSimulationUpdate}
          />
          <WhatIfSliders addLog={addLog} onChange={setSliderParams} />
        </div>

        <aside className="command-scroll flex max-h-[calc(100vh-104px)] flex-col gap-4 overflow-y-auto pr-1">
          <ExplainabilityPanel
            finalRiskScore={simulation?.final_risk_score}
            riskFactors={simulation?.risk_factors}
          />
          <IncidentCommanderPanel
            addLog={addLog}
            onRecommendation={setRecommendation}
            regionData={regionData}
            simulation={simulation}
          />
          {recommendation && (
            <section className="rounded border border-red-500/30 bg-red-500/10 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-200">Critical Decision</h2>
              <div className="mt-3 space-y-4 text-sm">
                <div>
                  <div className="font-bold text-orange-200">Evacuate</div>
                  {recommendation.evacuate.map((item) => (
                    <p className="mt-1 text-slate-100" key={item.location}>! {item.location}: {item.time_minutes} min - {item.reason}</p>
                  ))}
                </div>
                <div>
                  <div className="font-bold text-cyan-200">Deploy Resources</div>
                  {recommendation.deploy_resources.map((item, index) => (
                    <p className="mt-1 text-slate-100" key={`${item.type}-${index}`}>Unit {item.count}: {item.type} from {item.from}</p>
                  ))}
                </div>
                <div>
                  <div className="font-bold text-slate-200">Road Closures</div>
                  {recommendation.road_closures.map((item) => <p className="mt-1 text-slate-300" key={item}>- {item}</p>)}
                </div>
                <div>
                  <div className="font-bold text-cyan-200">Priority Protect</div>
                  {recommendation.priority_protect.map((item) => <p className="mt-1 text-slate-100" key={item.location}>{item.location}: {item.reason}</p>)}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-300">
                    <span>Confidence</span>
                    <span>{recommendation.confidence_percent}%</span>
                  </div>
                  <div className="h-2 rounded bg-slate-800">
                    <div className="h-2 rounded bg-cyan-400" style={{ width: `${recommendation.confidence_percent}%` }} />
                  </div>
                </div>
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-100">
                  {recommendation.cascading_risks.map((risk) => <p key={risk}>! {risk}</p>)}
                </div>
                <div className="inline-flex rounded border border-orange-400/40 bg-orange-500/15 px-3 py-2 font-bold text-orange-200">
                  Containment Estimate: {recommendation.containment_estimate_percent}%
                </div>
              </div>
            </section>
          )}
          <AlertComposer addLog={addLog} recommendation={recommendation} />
          <AskAIPanel addLog={addLog} recommendation={recommendation} simulation={simulation} />
          <Timeline logs={logs} />
        </aside>
      </main>
    </div>
  )
}
