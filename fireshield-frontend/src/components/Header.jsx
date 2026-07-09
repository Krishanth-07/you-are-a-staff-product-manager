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
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm">
            FS
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              Wildfire Operations Console
            </div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 leading-tight">
              FireShield AI
            </h1>
            <p className="text-xs text-gray-500">
              Decision support for Nilgiris response planning
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">{timeLabel}</div>
          <div className="text-[10px] text-gray-400">Local system time</div>
        </div>
      </div>
    </header>
  );
}
