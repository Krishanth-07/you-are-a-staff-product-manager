export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-[#0a0e1a]/95 px-5 py-4 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white md:text-2xl">
            FireShield AI - Forest Fire Emergency Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-400">Nilgiris Biosphere Reserve, Tamil Nadu</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="rounded border border-red-500/50 bg-red-500/15 px-3 py-1 text-xs font-bold tracking-wide text-red-200">
            ACTIVE INCIDENT
          </span>
        </div>
      </div>
    </header>
  )
}
