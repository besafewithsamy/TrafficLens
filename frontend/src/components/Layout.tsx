import { NavLink, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import logo from '../assets/logo.png'
import { ThemeToggle } from './ThemeToggle'

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
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Persistent sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface/60">
        <div className="px-5 py-4">
          <img src={logo} alt="PacketSleuth" className="h-10 w-auto object-contain" />
          <div className="mt-1 text-xs uppercase tracking-widest text-fg-subtle">
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
                    ? 'bg-accent-soft text-accent ring-1 ring-accent-ring'
                    : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-fg-subtle">
          <span>Packet → Flow → Behavior → Event → Investigation</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Toast notifications (used by mutation flows) */}
      <Toaster theme="system" position="bottom-right" richColors closeButton />
    </div>
  )
}
