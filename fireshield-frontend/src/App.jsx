import { useCallback, useEffect, useMemo, useState } from "react";
import FireMap from "./components/FireMap";
import WhatIfSliders from "./components/WhatIfSliders";
import ExplainabilityPanel from "./components/ExplainabilityPanel";
import IncidentCommanderPanel from "./components/IncidentCommanderPanel";
import AlertComposer from "./components/AlertComposer";
import AskAIPanel from "./components/AskAIPanel";
import IncidentReportPanel from "./components/IncidentReportPanel";
import { Map, ShieldAlert, Bell, FileText, Activity } from "lucide-react";
import { getLiveWeather } from "./api";

const DEFAULT_SCENARIO = {
  wind_speed: 20,
  wind_direction: 90,
  humidity: 30,
};

function formatScore(score) {
  if (score == null) return "Awaiting simulation";
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Elevated Risk";
  return "Moderate Risk";
}

export default function App() {
  const [simulation, setSimulation] = useState(null);
  const [regionData, setRegionData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [sliderParams, setSliderParams] = useState(DEFAULT_SCENARIO);
  const [logs, setLogs] = useState([]);
  const [pageView, setPageView] = useState("map"); // "map", "plan", "alerts", "report"

  const addLog = useCallback((message) => {
    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...current,
    ]);
  }, []);

  const handleSimulationUpdate = useCallback((nextSimulation, nextRegion) => {
    setSimulation(nextSimulation);
    if (nextRegion) setRegionData(nextRegion);
  }, []);

  useEffect(() => {
    async function loadLiveWeather() {
      try {
        const weather = await getLiveWeather();
        setSliderParams((prev) => ({
          ...prev,
          wind_speed: Math.round(weather.wind_speed),
          wind_direction: Math.round(weather.wind_direction),
          humidity: Math.round(weather.humidity),
        }));
        addLog(`Live weather initialized: Wind ${Math.round(weather.wind_speed)}km/h, Hum ${Math.round(weather.humidity)}%`);
      } catch (e) {
        addLog("Failed to fetch live weather. Using defaults.");
      }
    }
    loadLiveWeather();
  }, [addLog]);

  const summary = useMemo(() => {
    const riskScore = simulation?.final_risk_score ?? null;
    const burnt = simulation?.total_cells_burnt ?? 0;
    const confidence = recommendation?.confidence_percent ?? null;
    const containment = recommendation?.containment_estimate_percent ?? null;
    const evacuationTarget =
      recommendation?.evacuate?.[0]?.location ?? "No active alerts";

    return {
      riskScore,
      burnt,
      confidence,
      containment,
      evacuationTarget,
      posture: formatScore(riskScore),
    };
  }, [recommendation, simulation]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f9fb] font-sans antialiased text-gray-900">
      
      {/* ==========================================
          LEFT SIDEBAR NAVIGATION & SCROLLABLE LOGS
          ========================================== */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col h-full shrink-0 shadow-sm">
        
        {/* Brand Section */}
        <div className="p-5 border-b border-gray-150">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-sm">
              FS
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-gray-900">
                FireShield AI
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 active-dot" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Nilgiris Console
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => setPageView("map")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              pageView === "map"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
            type="button"
          >
            <Map size={16} />
            Map Workspace
          </button>
          
          <button
            onClick={() => setPageView("plan")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              pageView === "plan"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
            type="button"
          >
            <ShieldAlert size={16} />
            Action Plan
          </button>

          <button
            onClick={() => setPageView("alerts")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              pageView === "alerts"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
            type="button"
          >
            <Bell size={16} />
            Alerts & Chat
          </button>

          <button
            onClick={() => setPageView("report")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              pageView === "report"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
            type="button"
          >
            <FileText size={16} />
            Incident Report
          </button>
        </nav>

        {/* Sidebar Fixed Scrollable Logs */}
        <div className="border-t border-gray-150 p-4 bg-gray-50/50 flex flex-col h-48 shrink-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              System Events
            </span>
            <Activity size={10} className="text-gray-400" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 command-scroll">
            {logs.length === 0 ? (
              <span className="text-[10px] text-gray-400 font-medium block">
                No events recorded. Initialize simulation.
              </span>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-[10px] leading-normal border-b border-gray-100 pb-1.5 last:border-0">
                  <span className="mono text-gray-400 font-semibold mr-1.5">{log.time}</span>
                  <span className="text-gray-700 font-medium">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN CONTENT WORKSPACE AREA
          ========================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Sticky Status Bar */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Active Session Status:
            </span>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                {summary.posture}
              </span>
              {simulation && (
                <>
                  <span className="text-[11px] text-gray-400 font-bold">·</span>
                  <span className="text-[11px] text-gray-500 font-semibold">
                    Risk Index: <strong className="text-gray-800">{summary.riskScore}/100</strong>
                  </span>
                  <span className="text-[11px] text-gray-400 font-bold">·</span>
                  <span className="text-[11px] text-gray-500 font-semibold">
                    Affected Area: <strong className="text-gray-800">{summary.burnt} cells</strong>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-[11px] text-gray-400 font-bold">
            DEOC Command Center - Nilgiris District
          </div>
        </header>

        {/* Workspace Views Routing */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Workspace Page 1: Map & Sliders */}
          {pageView === "map" && (
            <div className="flex flex-col gap-6 max-w-[1200px] mx-auto">
              <FireMap
                addLog={addLog}
                externalParams={sliderParams}
                onSimulationUpdate={handleSimulationUpdate}
              />
              <WhatIfSliders
                values={sliderParams}
                onChange={setSliderParams}
                addLog={addLog}
              />
            </div>
          )}

          {/* Workspace Page 2: Action Plan */}
          {pageView === "plan" && (
            <div className="flex flex-col gap-6 max-w-[900px] mx-auto">
              <ExplainabilityPanel
                finalRiskScore={summary.riskScore}
                riskFactors={simulation?.risk_factors}
              />
              <IncidentCommanderPanel
                addLog={addLog}
                onRecommendation={setRecommendation}
                recommendation={recommendation}
                regionData={regionData}
                simulation={simulation}
              />
            </div>
          )}

          {/* Workspace Page 3: Alerts & Chat */}
          {pageView === "alerts" && (
            <div className="flex flex-col gap-6 max-w-[1000px] mx-auto">
              <AlertComposer addLog={addLog} recommendation={recommendation} regionData={regionData} />
              <AskAIPanel
                addLog={addLog}
                recommendation={recommendation}
                simulation={simulation}
              />
            </div>
          )}

          {/* Workspace Page 4: Official Report */}
          {pageView === "report" && (
            <div className="max-w-[800px] mx-auto">
              <IncidentReportPanel
                addLog={addLog}
                logs={logs}
                recommendation={recommendation}
                simulation={simulation}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
