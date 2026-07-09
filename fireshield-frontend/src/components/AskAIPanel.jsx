import { useState } from 'react'
import { askAI } from '../api'

const suggestions = [
  'What changed in the last update?',
  'Who is most at risk?',
  'What should we do next?',
]

function summarizeSimulation(simulation) {
  if (!simulation) return null
  const finalStep = simulation.time_steps_data?.[simulation.time_steps_data.length - 1] || []
  const counts = finalStep.reduce(
    (acc, cell) => {
      acc[cell.status] = (acc[cell.status] || 0) + 1
      return acc
    },
    { unburnt: 0, burning: 0, burnt: 0 },
  )

  return {
    grid_size: simulation.grid_size,
    final_risk_score: simulation.final_risk_score,
    risk_factors: simulation.risk_factors,
    total_cells_burnt: simulation.total_cells_burnt,
    final_step_counts: counts,
  }
}

export default function AskAIPanel({ simulation, recommendation, addLog }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const submitQuestion = async (value = question) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setQuestion('')
    setLoading(true)
    setMessages((current) => [...current, { role: 'user', text: trimmed }])
    try {
      const context = {
        simulation: summarizeSimulation(simulation),
        incident_commander: recommendation,
      }
      const response = await askAI(trimmed, context)
      setMessages((current) => [...current, { role: 'ai', text: response.answer }])
      addLog?.(`Ask AI answered: ${trimmed}`)
    } catch (err) {
      setMessages((current) => [...current, { role: 'ai', text: err.message || 'AI request failed' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Ask FireShield AI</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button className="rounded-full border border-cyan-500/30 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/10" key={item} onClick={() => submitQuestion(item)} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="command-scroll mt-4 max-h-56 space-y-3 overflow-y-auto">
        {messages.map((message, index) => (
          <div className={`rounded p-3 text-sm ${message.role === 'user' ? 'ml-8 bg-cyan-500/15 text-cyan-50' : 'mr-8 bg-slate-800 text-slate-100'}`} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="mr-8 rounded bg-slate-800 p-3 text-sm text-slate-300">Thinking...</div>}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submitQuestion()
        }}
      >
        <input
          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask FireShield AI..."
          value={question}
        />
        <button className="rounded bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300" type="submit">
          Send
        </button>
      </form>
    </section>
  )
}
