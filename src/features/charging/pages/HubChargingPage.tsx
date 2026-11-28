// Hub & quản lý sạc · theo dõi tài nguyên OP-02/OP-03 (Figma Operations_Hub_Charging_Management_Screen 112:4)
import { useState } from 'react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { isHeartbeatFresh } from '../../../store/vehicleJourneySlice'
import type { ChargingPoint, VehicleStatus } from '../../../types'
import { Card, CardTitle, KpiCard, Notice, PageHeader, Pill, inputClass, tableHeadClass } from '../../../components/shared/ui'
import { formatTime } from '../../../lib/format'
import { pointStatusView, vehicleStatusView } from '../../../lib/labels'
import { useNow } from '../../../lib/useNow'
import ResourceTabs from '../components/ResourceTabs'

const PAGE = 12
const clock = (iso: string) => { const date = new Date(iso); return `${formatTime(iso)}:${String(date.getSeconds()).padStart(2, '0')}` }

export default function HubChargingPage() {
  const now = useNow()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const points = useMobilityStore((s) => s.chargingPoints)
  const requests = useMobilityStore((s) => s.chargingRequests)
  const orders = useMobilityStore((s) => s.dispatchOrders)
  const startCharging = useMobilityStore((s) => s.startCharging)
  const completeCharging = useMobilityStore((s) => s.completeCharging)
  const reportFault = useMobilityStore((s) => s.reportChargingPointFault)
  const tick = useMobilityStore((s) => s.tickVehicleTelemetry)
  const [hubId, setHubId] = useState('ALL')
  const [status, setStatus] = useState<'ALL' | VehicleStatus>('ALL')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [refreshedAt, setRefreshedAt] = useState<number>()
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const term = query.trim().toLowerCase()
  const inHub = (id: string) => hubId === 'ALL' || id === hubId
  const filtered = vehicles.filter((vehicle) => inHub(vehicle.hubId) && (status === 'ALL' || vehicle.status === status)
    && (!term || `${vehicle.vehicleId} ${vehicle.hubId}`.toLowerCase().includes(term)))
  const hubPoints = points.filter((point) => inHub(point.hubId) && (!term || `${point.chargingPointId} ${point.vehicleId ?? ''}`.toLowerCase().includes(term)))
  const pointCount = (value: string) => points.filter((point) => point.status === value).length
  const ready = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').length
  const transitTarget = (vehicleId: string) => orders.find((order) => order.status === 'IN_PROGRESS' && order.vehicleIds.includes(vehicleId))?.destinationHubId
  const requestOn = (point: ChargingPoint) => requests.find((request) => request.chargingPointId === point.chargingPointId && (request.status === 'SCHEDULED' || request.status === 'CHARGING'))

  const pointAction = (point: ChargingPoint) => {
    const request = requestOn(point)
    if (point.status === 'ASSIGNED' && request) return { label: 'Xe kết nối', run: () => startCharging(request.requestId), done: `${point.chargingPointId}: xe ${request.vehicleId} đã kết nối, bắt đầu sạc.` }
    if (point.status === 'CHARGING' && request) return { label: 'Kết thúc sạc', run: () => completeCharging(request.requestId), done: `${point.chargingPointId}: đã sạc xong ${request.vehicleId}, cổng trở lại Trống.` }
    return undefined
  }

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Theo dõi tài nguyên · OP-02 / OP-03" title="Hub & quản lý sạc"
      subtitle="Theo dõi từng phương tiện và cổng sạc theo Hub; trạng thái được đồng bộ định kỳ mỗi 5 giây." />
    <ResourceTabs />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Xe sẵn sàng" value={ready} hint={`${Math.round((ready / Math.max(1, vehicles.length)) * 100)}% tổng số phương tiện`} hintTone="neutral" />
      <KpiCard label="Xe đang sử dụng" value={vehicles.filter((vehicle) => vehicle.status === 'IN_USE').length} hint="Có phiên di chuyển đang mở" hintTone="neutral" />
      <KpiCard label="Tổng cổng sạc" value={points.length} hint={`Phân bổ tại ${hubs.length} Hub`} hintTone="neutral" />
      <KpiCard label="Cổng sạc trống" value={pointCount('AVAILABLE')} hint={`${pointCount('ASSIGNED')} đã gán · ${pointCount('CHARGING')} đang sạc · ${pointCount('ERROR')} lỗi`} hintTone="neutral" />
    </div>

    <Card className="!py-4">
      <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto] md:items-end">
        <label className="text-xs text-[#5f716c]">Hub<select value={hubId} onChange={(event) => { setHubId(event.target.value); setLimit(PAGE) }} className={`${inputClass} mt-1`}><option value="ALL">Tất cả Hub ({hubs.length})</option>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.hubId} · {hub.name}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setLimit(PAGE) }} className={`${inputClass} mt-1`}><option value="ALL">Tất cả trạng thái</option>{(Object.keys(vehicleStatusView) as VehicleStatus[]).map((item) => <option key={item} value={item}>{vehicleStatusView[item].label}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Tìm xe / cổng sạc<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập mã xe, mã cổng hoặc Hub..." className={`${inputClass} mt-1`} /></label>
        <button type="button" onClick={() => { tick(); setRefreshedAt(Date.now()) }} className="rounded-lg bg-[#087f6a] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#066b59]">Làm mới dữ liệu</button>
      </div>
      {refreshedAt && <p className="mt-2 text-xs text-[#087f6a]">Đã đồng bộ lúc {clock(new Date(refreshedAt).toISOString())}</p>}
    </Card>

    {message && <Notice tone={message.tone} title={message.text} />}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="min-w-0">
        <CardTitle title="Theo dõi phương tiện" subtitle={`${vehicles.length} xe · ${hubs.length} Hub · Hiển thị trạng thái vận hành hiện tại`} />
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Mã xe</th><th>Hub</th><th>Trạng thái</th><th>Pin</th><th className="rounded-r-lg">Heartbeat</th></tr></thead>
          <tbody>{filtered.slice(0, limit).map((vehicle) => {
            const target = vehicle.status === 'IN_TRANSIT' ? transitTarget(vehicle.vehicleId) : undefined
            const stale = !isHeartbeatFresh(vehicle, now)
            return <tr key={vehicle.vehicleId} className="border-b border-[#e4ece9] last:border-0">
              <td className="px-3 py-3 font-semibold">{vehicle.vehicleId}</td>
              <td className="text-[#5f716c]">{vehicle.hubId}{target && ` → ${target}`}</td>
              <td><Pill tone={vehicleStatusView[vehicle.status].tone} className="min-w-28">{vehicleStatusView[vehicle.status].label}</Pill></td>
              <td className={`font-semibold ${vehicle.battery <= 20 ? 'text-[#946013]' : ''}`}>{vehicle.status === 'UNAVAILABLE' ? '—' : `${vehicle.battery}%`}</td>
              <td className={stale ? 'text-[#b42318]' : 'text-[#5f716c]'}>{clock(vehicle.lastHeartbeat)}{stale && ' · trễ'}</td>
            </tr>
          })}</tbody>
        </table></div>
        {filtered.length === 0 && <p className="mt-3 text-sm text-[#5f716c]">Không có xe nào khớp bộ lọc.</p>}
        {filtered.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-3 text-sm font-semibold text-[#087f6a] hover:underline">Xem thêm ({filtered.length - limit} xe)</button>}
        <p className="mt-4 text-xs text-[#5f716c]">Trạng thái hợp lệ gồm: {Object.values(vehicleStatusView).map((item) => item.label).join(' · ')}.</p>
        <p className="mt-2 text-xs text-[#5f716c]">Không nhận heartbeat trong 2 chu kỳ liên tiếp → đánh dấu Mất kết nối và cảnh báo Operator.</p>
      </Card>

      <Card className="min-w-0">
        <CardTitle title="Theo dõi cổng sạc" subtitle={`${points.length} cổng · ${hubs.length} Hub`} />
        <div className="grid grid-cols-2 gap-3">
          {([['Trống', 'AVAILABLE', 'bg-[#e6f4ef] text-[#087f6a]'], ['Đã gán', 'ASSIGNED', 'bg-[#edf4fa] text-[#2b5f8e]'], ['Đang sạc', 'CHARGING', 'bg-[#e6f4ef] text-[#087f6a]'], ['Lỗi', 'ERROR', 'bg-[#fde8e6] text-[#b42318]']] as const).map(([label, value, color]) =>
            <div key={value} className={`rounded-xl p-4 ${color}`}><p className="text-xs">{label}</p><p className="mt-1 text-2xl font-semibold">{points.filter((point) => inHub(point.hubId) && point.status === value).length}</p></div>)}
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase text-[#5f716c]"><tr><th className="py-2">Mã cổng</th><th>Trạng thái</th><th>kW</th><th className="text-right">Thao tác</th></tr></thead>
          <tbody>{hubPoints.map((point) => {
            const action = pointAction(point)
            return <tr key={point.chargingPointId} className="border-t border-[#e4ece9]">
              <td className="py-3"><p className="font-semibold">{point.chargingPointId}</p>{point.vehicleId && <p className="text-xs text-[#5f716c]">Xe {point.vehicleId}</p>}</td>
              <td><Pill tone={pointStatusView[point.status].tone}>{pointStatusView[point.status].label}</Pill></td>
              <td className="text-[#5f716c]">{point.status === 'ERROR' ? '—' : point.status === 'CHARGING' ? point.powerKw : 0}</td>
              <td className="space-x-2 whitespace-nowrap text-right">
                {action && <button type="button" onClick={() => { const result = action.run(); setMessage(result.ok ? { tone: 'success', text: action.done } : { tone: 'danger', text: 'Thao tác không hợp lệ với trạng thái hiện tại.' }) }} className="text-xs font-semibold text-[#087f6a] hover:underline">{action.label}</button>}
                {point.status !== 'ERROR' && <button type="button" onClick={() => { const id = reportFault(point.chargingPointId); if (id) setMessage({ tone: 'danger', text: `${point.chargingPointId} chuyển sang Lỗi, đã tạo sự cố ${id}. Yêu cầu đang dùng cổng được đưa lại hàng đợi.` }) }} className="text-xs font-semibold text-[#b42318] hover:underline">Báo lỗi</button>}
              </td>
            </tr>
          })}</tbody>
        </table></div>
        <p className="mt-4 text-xs leading-5 text-[#5f716c]">Cổng ở trạng thái Đã gán cho đến khi xe kết nối thực tế; sau handshake mới chuyển sang Đang sạc.</p>
        <p className="mt-2 text-xs leading-5 text-[#5f716c]">Quá nhiệt / mất kết nối → đánh dấu Lỗi, cập nhật dung lượng Hub và phát cảnh báo. Cổng lỗi được khôi phục từ màn Sự cố sau khi đội kỹ thuật xác nhận.</p>
      </Card>
    </div>
  </div>
}
