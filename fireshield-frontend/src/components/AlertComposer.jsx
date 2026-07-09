import { useMemo, useState, useEffect } from "react";
import { getPublicAlerts } from "../api";

export default function AlertComposer({
  recommendation,
  onAlertGenerated,
  addLog,
  regionData,
}) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locations = useMemo(
    () => recommendation?.evacuate?.map((item) => item.location) || [],
    [recommendation],
  );

  // Extract highways and shelters from regionData points of interest
  const highways = useMemo(
    () => regionData?.points_of_interest?.filter((poi) => poi.type === "highway") || [],
    [regionData]
  );

  const shelters = useMemo(
    () =>
      regionData?.points_of_interest?.filter(
        (poi) => poi.type === "hospital" || poi.type === "village"
      ) || [],
    [regionData]
  );

  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedShelter, setSelectedShelter] = useState("");

  // Sync initial dropdown selections
  useEffect(() => {
    if (highways.length && !selectedRoute) {
      setSelectedRoute(highways[0].name);
    }
  }, [highways, selectedRoute]);

  useEffect(() => {
    if (shelters.length && !selectedShelter) {
      setSelectedShelter(shelters[0].name);
    }
  }, [shelters, selectedShelter]);

  const generateAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getPublicAlerts({
        evacuate_locations: locations.length ? locations : ["Kotagiri Town Center"],
        safe_route: selectedRoute || "SH-15 Highway toward Kotagiri",
        shelter_name: selectedShelter || "District Hospital Kotagiri Relief Shelter",
        time_minutes: recommendation?.evacuate?.[0]?.time_minutes || 45,
      });
      setAlerts(response);
      onAlertGenerated?.(response);
      addLog?.(`Public alerts generated using route: ${selectedRoute || "SH-15"}`);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to generate alerts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="command-card p-6">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
            Alert Composer
          </h2>
          <p className="mt-1 text-xs text-gray-500 font-medium">
            Generate multi-channel warning alerts from active region parameters.
          </p>
        </div>
        <button
          className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          disabled={loading}
          onClick={generateAlerts}
          type="button"
        >
          {loading ? "Generating..." : "Generate Alerts"}
        </button>
      </div>

      {/* Dynamic Evacuation Route & Shelter Selectors */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="text-xs font-bold text-gray-700">
          <span className="block mb-1.5 uppercase tracking-wider text-[9px] text-gray-400">
            Designated Evacuation Route
          </span>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white p-2 text-xs font-medium text-gray-800 outline-none focus:border-blue-600 cursor-pointer"
          >
            {highways.length === 0 && <option value="">No routes detected</option>}
            {highways.map((poi) => (
              <option key={poi.name} value={poi.name}>
                {poi.name} (X: {poi.x}, Y: {poi.y})
              </option>
            ))}
          </select>
        </label>
        
        <label className="text-xs font-bold text-gray-700">
          <span className="block mb-1.5 uppercase tracking-wider text-[9px] text-gray-400">
            Target Relief Shelter
          </span>
          <select
            value={selectedShelter}
            onChange={(e) => setSelectedShelter(e.target.value)}
            className="w-full rounded border border-gray-200 bg-white p-2 text-xs font-medium text-gray-800 outline-none focus:border-blue-600 cursor-pointer"
          >
            {shelters.length === 0 && <option value="">No shelters detected</option>}
            {shelters.map((poi) => (
              <option key={poi.name} value={poi.name}>
                {poi.name} ({poi.type.toUpperCase()})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      {alerts && (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {["sms", "whatsapp", "press_release"].map((channel) => (
            <div
              className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm"
              key={channel}
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600">
                  {channel.replace("_", " ")}
                </div>
                {channel === "whatsapp" && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      "🚨 *EMERGENCY ALERT* 🚨\n\n" + alerts[channel]?.english + "\n\n" + alerts[channel]?.tamil
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded bg-[#25D366] px-2 py-0.5 text-[9px] font-bold text-white shadow-sm hover:bg-[#128C7E] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Broadcast
                  </a>
                )}
              </div>
              <div className="mt-3 space-y-3 text-xs text-gray-800">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    English
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-900 font-medium">
                    {alerts[channel]?.english}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    Tamil
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-900 font-medium">
                    {alerts[channel]?.tamil}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    Hindi
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-900 font-medium">
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
