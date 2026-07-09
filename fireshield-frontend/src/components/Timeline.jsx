import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Timeline({ logs }) {
  const [open] = useState(true);

  return (
    <section className="command-card">
      <div className="flex w-full items-center justify-between border-b border-slate-200/8 px-4 py-3 text-left">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Timeline
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Recent operational events
          </div>
        </div>
        <span className="text-xs text-slate-500">{logs.length} events</span>
      </div>
      {open && (
        <div className="command-scroll max-h-56 space-y-3 overflow-y-auto p-4">
          {logs.length === 0 && (
            <p className="text-sm text-slate-500">No operational events yet.</p>
          )}
          <AnimatePresence initial={false}>
            {logs.slice(0, 8).map((log) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200/10 bg-slate-950/55 p-3"
                exit={{ opacity: 0, y: 8 }}
                initial={{ opacity: 0, y: -14 }}
                key={log.id}
              >
                <div className="mono text-xs text-slate-500">{log.time}</div>
                <div className="mt-1 text-sm text-slate-200">{log.message}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
