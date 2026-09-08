import { NavLink, Outlet } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
  soon?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◉', end: true },
  { to: '/capture', label: 'Capture', icon: '⦿' },
  { to: '/flows', label: 'Flows', icon: '≋' },
  { to: '/hosts', label: 'Hosts', icon: '▤' },
  { to: '/protocol', label: 'Protocol', icon: '⟁' },
  { to: '/timeline', label: 'Timeline', icon: '⏱' },
  { to: '/graph', label: 'Graph', icon: '⦾' },
  { to: '/alerts', label: 'Alerts', icon: '⚠' },
  { to: '/replay', label: 'Replay', icon: '▶' },
  { to: '/engineer', label: 'Engineer Mode', icon: '⚙' },
]

export function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Persistent sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-lg text-emerald-400 ring-1 ring-emerald-500/30">
            ◈
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-100">
              TrafficLens
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Network Intelligence
            </div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) =>
            item.soon ? (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600"
                title="Coming in a later step"
              >
                <span className="w-4 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase text-slate-500">
                  soon
                </span>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`
                }
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="border-t border-slate-800 px-5 py-3 text-[10px] text-slate-600">
          Packet → Flow → Behavior → Event → Investigation
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
