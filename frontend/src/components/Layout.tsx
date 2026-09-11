import { NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/logo.png'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/capture', label: 'Capture' },
  { to: '/flows', label: 'Flows' },
  { to: '/hosts', label: 'Hosts' },
  { to: '/protocol', label: 'Protocol' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/graph', label: 'Graph' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/cases', label: 'Cases' },
  { to: '/replay', label: 'Replay' },
  { to: '/engineer', label: 'Engineer Mode' },
]

export function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Persistent sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60">
        <div className="px-5 py-4">
          <img src={logo} alt="PacketSleuth" className="h-10 w-auto object-contain" />
          <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
            Network Intelligence
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
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
