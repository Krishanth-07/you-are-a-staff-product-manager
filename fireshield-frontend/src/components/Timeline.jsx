import { useState } from 'react'

export default function Timeline({ logs }) {
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded border border-slate-800 bg-slate-950/80">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Timeline</span>
        <span className="text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="command-scroll max-h-52 space-y-3 overflow-y-auto border-t border-slate-800 p-4">
          {logs.length === 0 && <p className="text-sm text-slate-500">No operational events yet.</p>}
          {logs.map((log) => (
            <div className="border-l-2 border-cyan-500 pl-3" key={log.id}>
              <div className="text-xs text-slate-500">{log.time}</div>
              <div className="text-sm text-slate-200">{log.message}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
