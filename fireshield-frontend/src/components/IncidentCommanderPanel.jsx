import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getIncidentCommander } from "../api";

export default function IncidentCommanderPanel({
  simulation,
  regionData,
  onRecommendation,
  recommendation,
  addLog,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestRecommendation = async () => {
    if (!simulation) return;
    setLoading(true);
    setError("");
    try {
      const response = await getIncidentCommander({
        risk_score: simulation.final_risk_score,
        risk_factors: simulation.risk_factors,
        total_cells_burnt: simulation.total_cells_burnt,
        points_of_interest: regionData?.points_of_interest || [],
        ignition_x: simulation.ignition_x ?? 25,
        ignition_y: simulation.ignition_y ?? 25,
      });
      onRecommendation?.(response);
      addLog?.("Incident commander recommendation generated");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to generate recommendation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-6">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
            Incident Commander
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Generate response actions from current model parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recommendation && (
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-colors duration-150"
              onClick={() => {
                const text = `Command briefing. ${recommendation.evacuate.length} locations require evacuation. ${recommendation.deploy_resources.length} resource units deployed. Estimated containment confidence is ${recommendation.confidence_percent} percent.`;
                const utterance = new SpeechSynthesisUtterance(text);
                window.speechSynthesis.speak(utterance);
              }}
              type="button"
            >
              Play Briefing
            </button>
          )}
          <button
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!simulation || loading}
            onClick={requestRecommendation}
            type="button"
          >
            {loading ? "Analyzing..." : "Get Plan"}
          </button>
        </div>
      </div>

      {!recommendation && !loading && !error && (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <ShieldAlert className="text-gray-400" size={32} />
          <p className="mt-3 max-w-xs text-xs text-gray-500">
            Run the recommendation engine to generate resources, closures, and evacuation plans.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {recommendation && (
        <div className="mt-5 space-y-4 text-xs text-gray-800">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Evacuation Section */}
            <div className="border-l-4 border-red-600 bg-white p-3.5 rounded-r-lg border border-y-gray-200 border-r-gray-200 shadow-sm">
              <div className="font-bold uppercase tracking-wider text-red-600 text-[10px]">
                Evacuation Strategy
              </div>
              <div className="mt-2 space-y-2.5">
                {recommendation.evacuate.map((item) => (
                  <div key={item.location}>
                    <div className="font-bold text-gray-900">{item.location}</div>
                    <div className="text-[11px] text-gray-500 leading-normal mt-0.5">
                      ETA {item.time_minutes} min · {item.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources Section */}
            <div className="border-l-4 border-blue-600 bg-white p-3.5 rounded-r-lg border border-y-gray-200 border-r-gray-200 shadow-sm">
              <div className="font-bold uppercase tracking-wider text-blue-600 text-[10px]">
                Resources Allocation
              </div>
              <div className="mt-2 space-y-2.5">
                {recommendation.deploy_resources.map((item, index) => (
                  <div key={`${item.type}-${index}`}>
                    <div className="font-bold text-gray-900 flex justify-between">
                      <span>{item.count} {item.type}</span>
                      {item.eta_minutes && (
                         <span className="text-blue-600">ETA: {item.eta_minutes} min</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 flex justify-between">
                      <span>Deploy from: {item.from}</span>
                      {item.to && <span className="font-medium text-gray-700">To: {item.to}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Road Closures Section */}
          <div className="border-l-4 border-gray-400 bg-white p-3.5 rounded-r-lg border border-y-gray-200 border-r-gray-200 shadow-sm">
            <div className="font-bold uppercase tracking-wider text-gray-600 text-[10px]">
              Road Closures & Exclusion Zones
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {recommendation.road_closures.map((item) => (
                <span
                  className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Priority Protect Section */}
          <div className="border-l-4 border-green-600 bg-white p-3.5 rounded-r-lg border border-y-gray-200 border-r-gray-200 shadow-sm">
            <div className="font-bold uppercase tracking-wider text-green-600 text-[10px]">
              Priority Protection Points
            </div>
            <div className="mt-2 space-y-2.5">
              {recommendation.priority_protect.map((item) => (
                <div key={item.location}>
                  <div className="font-bold text-gray-900">{item.location}</div>
                  <div className="text-[11px] text-gray-500 leading-normal mt-0.5">{item.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence and Containment Metrics */}
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <div>
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-gray-600">
                <span>Confidence Metric</span>
                <span className="mono">{recommendation.confidence_percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${recommendation.confidence_percent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-gray-600">
                <span>Containment Estimate</span>
                <span className="mono">{recommendation.containment_estimate_percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${recommendation.containment_estimate_percent}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <p className="mt-4 text-xs font-semibold text-gray-500">
          Running incident intelligence engine...
        </p>
      )}
      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
