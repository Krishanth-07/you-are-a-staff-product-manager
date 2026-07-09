import { useEffect, useState } from "react";

export default function Header() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeLabel = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-sm font-semibold text-slate-950 shadow-[0_16px_35px_rgba(14,165,233,.18)]">
            FS
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
              Wildfire operations console
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
              FireShield AI
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Decision support for Nilgiris response planning
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-medium text-slate-100">{timeLabel}</div>
          <div className="mt-1 text-xs text-slate-500">Local system time</div>
        </div>
      </div>
    </header>
  );
}
