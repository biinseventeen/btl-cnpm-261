// Student and Operator workspaces (Figma: "Điều hướng" sidebar + "Thanh công cụ" top bar).
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  ArrowLeftRight, Bell, CircleHelp, LayoutGrid, MapPinned, ParkingSquare, PlugZap, Route, RotateCcw, ScanLine,
  TriangleAlert, Waypoints, Zap, type LucideIcon,
} from 'lucide-react'
import { useMobilityStore } from '../../store/useMobilityStore'

type Role = 'student' | 'operator'

interface NavItem { to: string; label: string; icon: LucideIcon; match?: string[] }

const navigation: Record<Role, NavItem[]> = {
  student: [
    { to: '/student/vehicles', label: 'Tìm xe & Hub', icon: MapPinned },
    { to: '/student/trips', label: 'Hành trình của tôi', icon: Route },
    { to: '/student/parking', label: 'Đặt chỗ đỗ', icon: ParkingSquare },
    { to: '/student/private-ev', label: 'Xe cá nhân & lịch sạc', icon: PlugZap },
  ],
  operator: [
    { to: '/operator', label: 'Tổng quan mạng lưới', icon: LayoutGrid },
    { to: '/operator/hubs', label: 'Hub & quản lý sạc', icon: Zap, match: ['/operator/charging-queue'] },
    { to: '/operator/dispatch', label: 'Điều phối phương tiện', icon: ArrowLeftRight },
    { to: '/operator/incidents', label: 'Sự cố', icon: TriangleAlert },
    { to: '/operator/simulation', label: 'Mô phỏng What-if', icon: Waypoints },
    { to: '/operator/parking-slots', label: 'Giám sát ô đỗ', icon: ScanLine },
  ],
}

const operatorCrumbs: [string, string][] = [
  ['/operator/charging-queue', 'Vận hành / Hub & quản lý sạc / Hàng đợi sạc'],
  ['/operator/hubs', 'Vận hành / Hub & quản lý sạc'],
  ['/operator/dispatch', 'Vận hành / Điều phối phương tiện'],
  ['/operator/incidents', 'Vận hành / Sự cố'],
  ['/operator/simulation', 'Vận hành / Mô phỏng What-if'],
  ['/operator/parking-slots', 'Vận hành / Giám sát ô đỗ'],
  ['/operator', 'Vận hành / Mạng lưới'],
]

const profile: Record<Role, { initials: string; name: string; badge: string; switchTo: string; switchLabel: string }> = {
  student: { initials: 'MA', name: 'Minh Anh · Sinh viên', badge: 'Dành cho sinh viên', switchTo: '/operator', switchLabel: 'Vận hành' },
  operator: { initials: 'VH', name: 'Minh · Vận hành', badge: 'Không gian vận hành', switchTo: '/student/vehicles', switchLabel: 'Sinh viên' },
}

function Sidebar({ role }: { role: Role }) {
  const { pathname } = useLocation()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const resetDemo = useMobilityStore((s) => s.resetDemo)
  const isActive = (item: NavItem) => item.to === '/operator'
    ? pathname === '/operator'
    : pathname.startsWith(item.to) || !!item.match?.some((path) => pathname.startsWith(path))

  return <aside className="flex w-full shrink-0 flex-col border-b border-[#e4ece9] bg-white px-5 py-6 lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:border-b-0 lg:border-r">
    <Link to={role === 'student' ? '/student/vehicles' : '/operator'} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#087f6a] text-white"><Zap size={18} /></span>
      <span><span className="block text-sm font-semibold text-[#17332f]">Smart E-Mobility</span><span className="block text-xs text-[#5f716c]">Hub · ĐHQG-HCM</span></span>
    </Link>
    <span className="mt-6 w-fit rounded-full bg-[#eaf0ee] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#5f716c]">{profile[role].badge}</span>
    <nav className="mt-5 grid gap-1" aria-label="Điều hướng chính">
      {navigation[role].map((item) => {
        const active = isActive(item)
        return <NavLink key={item.to} to={item.to} aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? 'bg-[#e6f4ef] font-semibold text-[#087f6a]' : 'text-[#17332f] hover:bg-[#f4f7f6]'}`}>
          <item.icon size={17} className={active ? 'text-[#087f6a]' : 'text-[#5f716c]'} /> {item.label}
        </NavLink>
      })}
    </nav>
    <div className="mt-6 rounded-xl bg-[#f4f7f6] p-4 text-xs leading-5">
      <p className="font-semibold text-[#17332f]">Khu đô thị ĐHQG-HCM</p>
      {role === 'student'
        ? <><p className="mt-1 text-[#5f716c]">{hubs.length} Hub kết nối học tập</p><Link to="/student/vehicles" className="mt-1 block font-medium text-[#087f6a] hover:underline">Tìm xe, đỗ xe và sạc</Link></>
        : <><p className="mt-1 text-[#5f716c]">{hubs.length} Hub · {vehicles.length} xe điện</p><p className="mt-1 font-medium text-[#087f6a]">Ca sáng · 06:00–14:00</p></>}
    </div>
    <div className="mt-6 space-y-3 text-xs text-[#5f716c] lg:mt-auto">
      <button type="button" onClick={resetDemo} className="flex items-center gap-2 font-medium text-[#17332f] hover:text-[#087f6a]"><RotateCcw size={14} /> Nạp lại dữ liệu demo</button>
      <p className="flex items-center gap-2"><CircleHelp size={14} /> Trung tâm hỗ trợ</p>
      <p>L01-N8 · Bản mockup học phần</p>
    </div>
  </aside>
}

function TopBar({ role }: { role: Role }) {
  const { pathname } = useLocation()
  const openIncidents = useMobilityStore((s) => s.incidents.filter((incident) => incident.status !== 'RESOLVED').length)
  const crumb = role === 'student' ? 'Sinh viên / Khu đô thị ĐHQG-HCM' : operatorCrumbs.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Vận hành'
  const me = profile[role]
  return <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ece9] bg-white px-4 py-4 sm:px-8 lg:h-20">
    <p className="text-sm text-[#5f716c]">{crumb}</p>
    <div className="flex flex-wrap items-center gap-3 text-sm sm:gap-4">
      <span className="rounded-full bg-[#eaf0ee] px-3 py-1 text-xs font-medium text-[#5f716c]">Dữ liệu minh họa</span>
      <Link to={me.switchTo} className="rounded-full border border-[#d7e2de] px-3 py-1 text-xs font-semibold text-[#087f6a] hover:bg-[#e6f4ef]">Chuyển sang {me.switchLabel}</Link>
      <span className="font-semibold text-[#17332f]">VI / EN</span>
      <span className="relative text-[#5f716c]" title={role === 'operator' ? `${openIncidents} sự cố đang mở` : 'Thông báo'}>
        <Bell size={18} />
        {role === 'operator' && openIncidents > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#b42318] px-1 text-[10px] font-semibold text-white">{openIncidents}</span>}
      </span>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e6f4ef] text-xs font-semibold text-[#087f6a]">{me.initials}</span>
      <span className="text-[#17332f]">{me.name}</span>
    </div>
  </header>
}

export function WorkspaceLayout({ role }: { role: Role }) {
  return <div className="min-h-screen bg-[#f4f7f6] text-[#17332f] lg:flex">
    <Sidebar role={role} />
    <div className="flex min-w-0 flex-1 flex-col">
      <TopBar role={role} />
      <main className="flex-1 px-4 py-8 sm:px-8"><Outlet /></main>
      <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-xs text-[#5f716c] sm:px-8">
        <span>Smart E-Mobility Hub · L01-N8</span><span>Giao diện minh họa · Không kết nối thiết bị thật</span>
      </footer>
    </div>
  </div>
}
