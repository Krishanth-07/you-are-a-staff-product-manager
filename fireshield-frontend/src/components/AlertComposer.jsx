import { useMemo, useState } from 'react'
import { getPublicAlerts } from '../api'

const channels = ['sms', 'whatsapp', 'press_release']

export default function AlertComposer({ recommendation, onAlertGenerated, addLog }) {
  const [activeChannel, setActiveChannel] = useState('sms')
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const locations = useMemo(() => recommendation?.evacuate?.map((item) => item.location) || [], [recommendation])

  const generateAlerts = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getPublicAlerts({
        evacuate_locations: locations.length ? locations : ['Kotagiri Village'],
        safe_route: 'NH-181 Highway toward Kotagiri town center',
        shelter_name: 'District Hospital relief shelter',
        time_minutes: recommendation?.evacuate?.[0]?.time_minutes || 45,
      })
      setAlerts(response)
      onAlertGenerated?.(response)
      addLog?.('Multilingual public alert generated')
    } catch (err) {
      setError(err.message || 'Unable to generate alerts')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Alert Composer</h2>
        <button
          className="rounded bg-orange-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onClick={generateAlerts}
          type="button"
        >
          {loading ? 'Generating...' : 'Generate Public Alert'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {alerts && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                className={`rounded px-3 py-1 text-xs font-semibold ${activeChannel === channel ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                key={channel}
                onClick={() => setActiveChannel(channel)}
                type="button"
              >
                {channel.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            {['english', 'tamil', 'hindi'].map((language) => (
              <div className="rounded border border-slate-800 bg-slate-900/70 p-3" key={language}>
                <div className="text-xs font-bold uppercase text-orange-300">{language}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-100">{alerts[activeChannel]?.[language]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
