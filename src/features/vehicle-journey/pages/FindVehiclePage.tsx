// VJ-01 Tìm xe điện dùng chung (Figma Student_Find_Vehicle_Hub_Screen 59:3)
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { BatteryMedium, Bike, Check, MapPinned, Search, Timer } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { estimatedRangeKm, isHeartbeatFresh, isReservable, JOURNEY_RULES, OPEN_VEHICLE_RESERVATION } from '../../../store/vehicleJourneySlice'
import { hubFreeSlots } from '../../../store/storeUtils'
import type { Hub, Vehicle } from '../../../types'
import { Button, Card, CardTitle, DetailRow, Notice, PageHeader, Pill, StatusTag, inputClass } from '../../../components/shared/ui'
import { formatTime, hubLabel } from '../../../lib/format'
import { vehicleTypeLabel } from '../../../lib/labels'
import { DEMO_STUDENT_ID } from '../../../lib/demoUser'
import { useNow } from '../../../lib/useNow'
import { formatDistance, hubGeo } from '../journey'

const LISTED = ['AVAILABLE', 'PENDING_CHARGING', 'RESERVED']

function HubMap({ hubs, counts, selectedId, onSelect, now }: { hubs: Hub[]; counts: Record<string, number>; selectedId: string; onSelect: (hubId: string) => void; now: number }) {
  return <div className="relative h-[315px] overflow-hidden rounded-2xl border border-[#e4ece9] bg-[#eef3ef]">
    <svg viewBox="0 0 720 315" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      <path d="M0 40 C 90 30, 150 70, 210 60 S 300 10, 330 0 L0 0 Z" fill="#cfe3ef" />
      <path d="M560 315 C 600 250, 680 240, 720 230 L720 315 Z" fill="#d7ead9" />
      <path d="M-10 260 L 730 120" stroke="#ffffff" strokeWidth="14" />
      <path d="M-10 260 L 730 120" stroke="#dfe7e3" strokeWidth="2" strokeDasharray="10 8" />
      <path d="M180 -10 L 260 330" stroke="#ffffff" strokeWidth="10" />
      <path d="M430 -10 C 400 120, 470 220, 450 330" stroke="#ffffff" strokeWidth="9" />
      <path d="M0 170 L 720 200" stroke="#ffffff" strokeWidth="6" />
      <path d="M560 -10 L 600 330" stroke="#ffffff" strokeWidth="6" />
      <rect x="300" y="210" width="90" height="60" rx="6" fill="#e3ebe7" />
      <rect x="610" y="40" width="80" height="50" rx="6" fill="#e3ebe7" />
      <rect x="60" y="90" width="70" height="50" rx="6" fill="#e3ebe7" />
    </svg>
    <span className="absolute left-3.5 top-3.5 rounded-lg bg-white px-3 py-1.5 text-xs text-[#5f716c] shadow-sm">Cập nhật {formatTime(new Date(now).toISOString())} · gần thời gian thực</span>
    {hubs.map((hub) => {
      const geo = hubGeo[hub.hubId] ?? { x: 50, y: 50 }
      const count = counts[hub.hubId] ?? 0
      const selected = hub.hubId === selectedId
      return <button key={hub.hubId} type="button" onClick={() => onSelect(hub.hubId)}
        style={{ left: `${geo.x}%`, top: `${geo.y}%` }}
        className={`absolute flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition ${selected ? 'bg-[#087f6a] text-white' : count === 0 ? 'border border-[#e9c98f] bg-[#fffaf0] text-[#946013]' : 'border border-[#d7e2de] bg-white text-[#17332f] hover:border-[#087f6a]'}`}>
        <MapPinned size={14} /> {hub.name} · {count === 0 ? 'Hết xe' : `${count} xe`}
      </button>
    })}
  </div>
}

export default function FindVehiclePage() {
  const now = useNow()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const reservations = useMobilityStore((s) => s.vehicleReservations)
  const [query, setQuery] = useState('')
  const [hubId, setHubId] = useState(() => params.get('hubId') ?? [...hubs].sort((a, b) => (hubGeo[a.hubId]?.distance ?? 9e9) - (hubGeo[b.hubId]?.distance ?? 9e9))[0]?.hubId ?? '')
  const [vehicleId, setVehicleId] = useState<string>()
  const [showAll, setShowAll] = useState(false)

  const ready = (vehicle: Vehicle) => isReservable(vehicle) && isHeartbeatFresh(vehicle, now) && !vehicle.faultCode
  const counts: Record<string, number> = Object.fromEntries(hubs.map((hub) => [hub.hubId, vehicles.filter((vehicle) => vehicle.hubId === hub.hubId && ready(vehicle)).length]))
  const sortedHubs = [...hubs].sort((a, b) => (hubGeo[a.hubId]?.distance ?? 9e9) - (hubGeo[b.hubId]?.distance ?? 9e9))
  const term = query.trim().toLowerCase()
  const visibleHubs = term ? sortedHubs.filter((hub) => `${hub.name} ${hub.hubId} ${hub.address}`.toLowerCase().includes(term)) : sortedHubs
  const hub = hubs.find((item) => item.hubId === hubId)
  const atHub = vehicles.filter((vehicle) => vehicle.hubId === hubId && LISTED.includes(vehicle.status))
    .sort((a, b) => Number(ready(b)) - Number(ready(a)) || b.battery - a.battery)
  const listed = showAll ? atHub : atHub.slice(0, 6)
  const selected = vehicles.find((vehicle) => vehicle.vehicleId === vehicleId && vehicle.hubId === hubId) ?? atHub.find(ready) ?? atHub[0]
  const mine = reservations.filter((item) => item.studentId === DEMO_STUDENT_ID && OPEN_VEHICLE_RESERVATION.includes(item.status)).at(-1)
  const alternative = sortedHubs.find((item) => item.hubId !== hubId && (counts[item.hubId] ?? 0) > 0)

  const selectHub = (id: string) => { setHubId(id); setVehicleId(undefined); setShowAll(false) }
  const vehicleTag = (vehicle: Vehicle) => ready(vehicle) ? <Pill tone="success">Sẵn sàng</Pill>
    : vehicle.status === 'RESERVED' ? <Pill tone="info">Đã được giữ</Pill>
      : vehicle.battery <= JOURNEY_RULES.minBattery ? <Pill tone="warn">Pin thấp</Pill> : <Pill tone="neutral">Chưa sẵn sàng</Pill>
  const blockedReason = !selected ? undefined
    : mine ? 'Bạn đang có một phiếu đặt xe hoặc chuyến đi chưa kết thúc.'
      : selected.status === 'RESERVED' ? 'Xe đã được sinh viên khác giữ trước.'
        : selected.battery <= JOURNEY_RULES.minBattery ? 'Pin từ 20% trở xuống, xe đang chờ sạc.'
          : !ready(selected) ? 'Xe chưa sẵn sàng để đặt trước.' : undefined

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Tìm kiếm / Xe dùng chung" title="Tìm xe điện dùng chung"
      subtitle="Chọn Hub trên bản đồ để xem xe đang sẵn sàng, rồi chọn một xe để xem chi tiết và đặt trước." />

    {mine && <Notice tone="info" title={`Bạn đang có phiếu ${mine.reservationId} (${mine.status === 'IN_USE' ? 'đang di chuyển' : 'đang giữ xe'})`}>
      Mỗi sinh viên chỉ giữ 1 xe tại một thời điểm. <Link to="/student/trips" className="font-semibold underline">Mở hành trình của tôi</Link>
    </Notice>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <div className="relative">
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm kiếm Hub"
            placeholder="Tìm kiếm Hub (Ga Metro, Ký túc xá khu A...)" className={`${inputClass} pr-10`} />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f716c]" />
        </div>
        <HubMap hubs={visibleHubs} counts={counts} selectedId={hubId} onSelect={selectHub} now={now} />

        <Card>
          <CardTitle title="Hub lân cận" subtitle="Chọn Hub để xem danh sách xe đang khả dụng · sắp xếp theo khoảng cách" />
          {visibleHubs.length === 0 ? <p className="text-sm text-[#5f716c]">Không có Hub nào khớp "{query}".</p> :
            <ul className="space-y-3">{visibleHubs.map((item) => {
              const count = counts[item.hubId] ?? 0
              const active = item.hubId === hubId
              return <li key={item.hubId}><button type="button" onClick={() => selectHub(item.hubId)}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${active ? 'border-[#087f6a] bg-[#e6f4ef]' : 'border-[#e4ece9] hover:bg-[#f4f7f6]'}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-[#087f6a] text-white' : 'bg-[#eaf0ee] text-[#5f716c]'}`}><MapPinned size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#17332f]">{hubLabel(item)}</span><span className="block text-xs text-[#5f716c]">Cách bạn {formatDistance(hubGeo[item.hubId]?.distance)}</span></span>
                {count === 0 ? <Pill tone="warn">Hết xe</Pill> : <Pill tone="success">{count} xe</Pill>}
                <Pill tone="neutral">{hubFreeSlots(item)} chỗ trống</Pill>
              </button></li>
            })}</ul>}
        </Card>

        <Card>
          <CardTitle title={`Xe khả dụng tại ${hub?.name ?? '—'}`} subtitle={`${counts[hubId] ?? 0} xe sẵn sàng · chọn một xe để xem chi tiết và đặt trước`} />
          {atHub.length === 0 ? <p className="text-sm text-[#5f716c]">Hub này hiện không có xe. Thử một Hub lân cận khác.</p> :
            <ul className="space-y-3">{listed.map((vehicle) => {
              const active = vehicle.vehicleId === selected?.vehicleId
              return <li key={vehicle.vehicleId}><button type="button" onClick={() => setVehicleId(vehicle.vehicleId)}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${active ? 'border-[#087f6a] bg-[#e6f4ef]' : 'border-[#e4ece9] hover:bg-[#f4f7f6]'}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#087f6a] ring-1 ring-[#e4ece9]"><Bike size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#17332f]">{vehicle.vehicleId}</span><span className="block text-xs text-[#5f716c]">{vehicleTypeLabel(vehicle)}</span></span>
                <span className="text-right text-sm"><span className={`flex items-center justify-end gap-1 font-semibold ${vehicle.battery <= JOURNEY_RULES.minBattery ? 'text-[#946013]' : 'text-[#17332f]'}`}><BatteryMedium size={15} />{vehicle.battery}%</span><span className="block text-xs text-[#5f716c]">~{estimatedRangeKm(vehicle)} km</span></span>
                <span className="w-28 text-right">{vehicleTag(vehicle)}</span>
              </button></li>
            })}</ul>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5f716c]">
            <span>Hiển thị {listed.length}/{atHub.length} xe · sắp xếp theo mức pin · xe có pin ≤ {JOURNEY_RULES.minBattery}% không thể đặt trước</span>
            {atHub.length > 6 && <button type="button" onClick={() => setShowAll(!showAll)} className="font-semibold text-[#087f6a] hover:underline">{showAll ? 'Thu gọn' : 'Xem tất cả'}</button>}
          </div>
        </Card>
      </div>

      <aside className="min-w-0 space-y-6">
        <Card>
          {selected ? <>
            <CardTitle title={`Chi tiết xe ${selected.vehicleId}`} subtitle={`${vehicleTypeLabel(selected)} · ${hubLabel(hub)}`} />
            <div className="grid h-36 place-items-center rounded-xl bg-[#eaf0ee] text-center text-xs text-[#5f716c]"><div><Bike size={36} className="mx-auto mb-2 text-[#087f6a]" />Ảnh minh họa xe {selected.vehicleId}</div></div>
            <div className="mt-4">{blockedReason ? <StatusTag tone="warn">Chưa thể đặt trước</StatusTag> : <StatusTag tone="success">Sẵn sàng · có thể đặt trước</StatusTag>}</div>
            <div className="mt-3">
              <DetailRow label="Mã xe" value={selected.vehicleId} />
              <DetailRow label="Loại xe" value={vehicleTypeLabel(selected)} />
              <DetailRow label="Mức pin hiện tại" value={`${selected.battery}%`} />
              <DetailRow label="Quãng đường ước tính" value={`~${estimatedRangeKm(selected)} km`} />
              <DetailRow label="Hub hiện tại" value={hubLabel(hub)} />
            </div>
            <Button className="mt-4" icon={<Timer size={16} />} disabled={!!blockedReason} onClick={() => navigate(`/student/vehicles/${selected.vehicleId}/reserve`)}>Đặt trước xe này</Button>
            <p className="mt-3 text-xs text-[#5f716c]">{blockedReason ?? `Xe được giữ tối đa ${JOURNEY_RULES.holdMinutes} phút sau khi đặt trước.`}</p>
          </> : <CardTitle title="Chưa chọn xe" subtitle="Chọn một Hub còn xe để xem chi tiết." />}
        </Card>

        <Card tone="success">
          <CardTitle title="Điều kiện đặt trước" subtitle="Hệ thống kiểm tra khi bạn nhấn Đặt trước xe" />
          <ul className="space-y-3 text-sm text-[#17332f]">
            {[`Xe ở trạng thái Sẵn sàng và pin trên ${JOURNEY_RULES.minBattery}%`, 'Bạn chưa có đơn đặt hoặc chuyến đi nào chưa hoàn thành', `Giữ xe tối đa ${JOURNEY_RULES.holdMinutes} phút; quá hạn hệ thống tự hủy phiếu đặt`]
              .map((rule) => <li key={rule} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#087f6a]" />{rule}</li>)}
          </ul>
        </Card>

        <Card>
          <CardTitle title="Nếu xe không còn khả dụng" />
          <p className="text-sm leading-6 text-[#5f716c]">Nếu xe vừa được người khác đặt hoặc chuyển sang bảo trì, hệ thống báo "Phương tiện hiện không còn khả dụng" và tự làm mới danh sách. Hub hết xe sẽ gợi ý Hub gần nhất còn xe{alternative ? ` (ví dụ ${alternative.name} · ${counts[alternative.hubId]} xe, cách ${formatDistance(hubGeo[alternative.hubId]?.distance)})` : ''}.</p>
          {alternative && <button type="button" onClick={() => selectHub(alternative.hubId)} className="mt-3 text-sm font-semibold text-[#087f6a] hover:underline">Xem Hub thay thế →</button>}
        </Card>
      </aside>
    </div>
  </div>
}
