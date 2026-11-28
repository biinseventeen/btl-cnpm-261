import { NavLink } from 'react-router'

// "Hub & quản lý sạc" holds two screens: resource tracking and the charging queue
export default function ResourceTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 text-sm font-semibold ${isActive ? 'bg-[#087f6a] text-white' : 'bg-white text-[#17332f] hover:bg-[#e6f4ef]'}`
  return <nav className="flex flex-wrap gap-2" aria-label="Hub & quản lý sạc">
    <NavLink to="/operator/hubs" className={tab}>Phương tiện & cổng sạc</NavLink>
    <NavLink to="/operator/charging-queue" className={tab}>Hàng đợi sạc</NavLink>
  </nav>
}
