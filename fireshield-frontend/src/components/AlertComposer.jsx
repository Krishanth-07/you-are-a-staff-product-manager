import { useMemo, useState } from "react";
import { getPublicAlerts } from "../api";

export default function AlertComposer({
  recommendation,
  onAlertGenerated,
  addLog,
}) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locations = useMemo(
    () => recommendation?.evacuate?.map((item) => item.location) || [],
    [recommendation],
  );

  const generateAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getPublicAlerts({
        evacuate_locations: locations.length ? locations : ["Kotagiri Village"],
        safe_route: "NH-181 Highway toward Kotagiri town center",
        shelter_name: "District Hospital relief shelter",
        time_minutes: recommendation?.evacuate?.[0]?.time_minutes || 45,
      });
      setAlerts(response);
      onAlertGenerated?.(response);
      addLog?.("Public alert generated");
    } catch (err) {
      setError(err.message || "Unable to generate alerts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
            Alert composer
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Create a ready-to-send public warning from the latest response plan.
          </p>
        </div>
        <button
          className="rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-100 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onClick={generateAlerts}
          type="button"
        >
          {loading ? "Generating..." : "Generate Public Alert"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {alerts && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {["sms", "whatsapp", "press_release"].map((channel) => (
            <div
              className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3"
              key={channel}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                {channel.replace("_", " ")}
              </div>
              <div className="mt-3 space-y-3 text-sm text-slate-200">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    English
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-100">
                    {alerts[channel]?.english}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Tamil
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-100">
                    {alerts[channel]?.tamil}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Hindi
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-100">
                    {alerts[channel]?.hindi}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
