import { motion } from 'framer-motion'
import { Brain, CloudRain, Flame, MessageSquare, Satellite, Truck } from 'lucide-react'

const agents = [
  { label: 'Ingest', note: 'Satellite terrain and ignition context', Icon: Satellite },
  { label: 'Model', note: 'Weather and spread simulation', Icon: CloudRain },
  { label: 'Plan', note: 'Crew, route, and shelter allocation', Icon: Truck },
  { label: 'Respond', note: 'Alert text and command recommendation', Icon: Brain },
]

export default function AgentPipeline() {
  return (
    <section className="mx-auto mt-4 w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
      <div className="command-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/8 pb-3">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Operational workflow</div>
            <div className="mt-1 text-sm text-slate-400">A compact view of the response pipeline used by the workspace.</div>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Live
          </div>
        </div>

        <div className="grid gap-3 pt-4 lg:grid-cols-4">
        {agents.map(({ label, note, Icon }, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3"
            initial={{ opacity: 0, y: 8 }}
            key={label}
            transition={{ delay: index * 0.04, duration: 0.2 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/10 bg-white/5 text-cyan-300">
                <Icon size={17} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">{label}</div>
                <div className="mt-1 text-[11px] leading-4 text-slate-400">{note}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      </div>
    </section>
  )
}
