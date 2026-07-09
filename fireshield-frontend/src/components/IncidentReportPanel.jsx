import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { generateIncidentReport } from "../api";

function compactSimulation(simulation) {
  if (!simulation) return null;
  return {
    grid_size: simulation.grid_size,
    final_risk_score: simulation.final_risk_score,
    risk_factors: simulation.risk_factors,
    total_cells_burnt: simulation.total_cells_burnt,
  };
}

export default function IncidentReportPanel({
  simulation,
  recommendation,
  logs,
  addLog,
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const logStrings = useMemo(
    () => logs.map((log) => `${log.time} - ${log.message}`),
    [logs],
  );

  const generateReport = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await generateIncidentReport(
        compactSimulation(simulation),
        recommendation || {},
        logStrings,
      );
      setReport(response);
      addLog?.("Official incident report generated");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to generate incident report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-6">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
            Incident Report
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Draft an official operational response report.
          </p>
        </div>
        <button
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || !simulation}
          onClick={generateReport}
          type="button"
        >
          {loading ? "Drafting..." : "Draft Report"}
        </button>
      </div>

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center text-center py-8">
          <FileText className="text-gray-400" size={32} />
          <p className="mt-3 max-w-xs text-xs text-gray-500">
            Draft the official report package once the simulation state is compiled.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      {report && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="incident-report-print mt-5 rounded-lg border border-gray-300 bg-amber-50/20 p-5 text-gray-900 shadow-sm"
          initial={{ opacity: 0, y: 12 }}
        >
          <div className="border-b-2 border-gray-900 pb-3 text-center font-sans">
            <div className="text-[10px] font-extrabold tracking-wider text-gray-500">
              GOVERNMENT OF TAMIL NADU · FOREST DEPARTMENT
            </div>
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-950 mt-0.5">
              District Emergency Operations Centre
            </div>
            <div className="mono mt-2 text-base font-bold text-gray-900 bg-gray-100/80 px-2 py-0.5 rounded inline-block">
              {report.incident_id}
            </div>
          </div>

          <div className="mt-5 space-y-4 text-[11px] leading-relaxed text-gray-800 font-serif">
            <section>
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                I. Executive Summary
              </h3>
              <p className="mt-1">{report.summary}</p>
            </section>

            <section>
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                II. Incident Timeline
              </h3>
              <p className="mt-1 whitespace-pre-line font-mono text-[10px] text-gray-600 bg-gray-50 p-2 rounded">
                {report.timeline_narrative}
              </p>
            </section>

            <section>
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                III. Containment Actions Taken
              </h3>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                {report.actions_taken.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                IV. Resources Deployed
              </h3>
              <p className="mt-1">{report.resources_deployed}</p>
            </section>

            <section>
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                V. Population Impact Assessment
              </h3>
              <p className="mt-1">{report.population_impact}</p>
            </section>

            <section className="border-t border-gray-200 pt-3">
              <h3 className="font-sans font-bold uppercase tracking-wider text-gray-950 text-[10px]">
                VI. Post-Incident Recommendation
              </h3>
              <p className="mt-1 font-semibold text-gray-900">{report.recommendation}</p>
            </section>
          </div>

          <button
            className="no-print mt-5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors duration-150"
            onClick={() => window.print()}
            type="button"
          >
            Print / Export PDF
          </button>
        </motion.div>
      )}
    </section>
  );
}
