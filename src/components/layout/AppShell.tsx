import { NavLink, Outlet } from 'react-router'
import { Activity, BatteryCharging, CarFront, LayoutDashboard, ParkingSquare } from 'lucide-react'

const links = [
  { to: '/operator', label: 'Operation', icon: LayoutDashboard },
  { to: '/student/vehicles', label: 'Vehicle Journey', icon: CarFront },
  { to: '/charging', label: 'Charging', icon: BatteryCharging },
  { to: '/parking', label: 'Parking & Private EV', icon: ParkingSquare },
]

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-700">L01-N8 · CO3001</p>
            <h1 className="text-lg font-bold">Smart E-Mobility Hub</h1>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">MVP · Mock data</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Modules</p>
          <nav className="grid gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icon size={17} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Giao diện khung để nhóm thay thế bằng các màn hình Figma đã thống nhất.
          </div>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
      <footer className="mx-auto max-w-7xl px-5 pb-6 text-xs text-slate-400">Smart E-Mobility Hub · Demo scaffold · L01-N8</footer>
    </div>
  )
}