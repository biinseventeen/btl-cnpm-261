// Parking Slot Monitoring (operator side) with a sensor simulator, since the demo has no real IoT.
import { useState } from 'react'
import { Link } from 'react-router'
import { RotateCcw } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { availableCapacity } from '../../../store/parkingSlice'
import type { ParkingReservationStatus, ParkingSensorStatus, ParkingSlot } from '../../../types'
import SlotGrid from '../components/SlotGrid'
import { formatTime, hubLabel } from '../format'
import { useNow } from '../../../lib/useNow'
import { useScrollTop } from '../../../lib/useScrollTop'
import { Card, CardTitle, PageHeader, StatusTag, type Tone } from '../ui'

const reservationTone: Record<ParkingReservationStatus, Tone> = {
  HELD: 'success', SLOT_ASSIGNED: 'success', ARRIVED: 'success', COMPLETED: 'neutral',
  CANCELLED: 'neutral', EXPIRED: 'warn', CHECK_IN_FAILED: 'danger',
}
const sensorLabel: Record<ParkingSensorStatus, string> = { ONLINE: 'Cảm biến ổn', STALE: 'Mất tín hiệu', FAULT: 'Lỗi' }

export default function ParkingSlotsPage() {
  const now = useNow()
  useScrollTop()
  const hubs = useMobilityStore((s) => s.hubs)
  const allSlots = useMobilityStore((s) => s.parkingSlots)
  const reservations = useMobilityStore((s) => s.parkingReservations)
  const incidents = useMobilityStore((s) => s.incidents)
  const reportSensor = useMobilityStore((s) => s.reportSlotSensor)
  const setSensorStatus = useMobilityStore((s) => s.setSlotSensorStatus)
  const resetDemo = useMobilityStore((s) => s.resetDemo)
  const [hubId, setHubId] = useState(hubs[0]?.hubId ?? '')
  const [lastEvent, setLastEvent] = useState<string>()

  const hub = hubs.find((item) => item.hubId === hubId)
  const slots = allSlots.filter((slot) => slot.hubId === hubId)
  const hubReservations = reservations.filter((item) => item.hubId === hubId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const hubIncidents = incidents.filter((item) => item.hubId === hubId && item.status !== 'RESOLVED').slice(-5).reverse()

  const report = (slot: ParkingSlot, reading: 'OCCUPIED' | 'FREE') => {
    const outcome = reportSensor(slot.slotId, reading)
    const text: Record<typeof outcome, string> = {
      ARRIVED: `Ô ${slot.slotId}: xe vào đúng ô đã cấp, đơn chuyển sang Đã đến.`,
      COMPLETED: `Ô ${slot.slotId}: xe rời ô, đơn hoàn tất.`,
      UNEXPECTED_OCCUPANCY: `Ô ${slot.slotId}: có xe nhưng không có đơn hợp lệ, đã báo sự cố.`,
      VEHICLE_LEFT: `Ô ${slot.slotId}: xe rời ô, ô trống trở lại.`,
      IGNORED: `Ô ${slot.slotId}: tín hiệu bị bỏ qua (cảm biến không ổn định hoặc trạng thái không đổi).`,
    }
    setLastEvent(text[outcome])
  }

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Vận hành / Giám sát ô đỗ" title="Trạng thái ô đỗ theo cảm biến"
      subtitle="Bảng mô phỏng thay cho cảm biến thật: bấm để gửi tín hiệu có xe / trống hoặc đổi tình trạng cảm biến." />

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" className="flex flex-wrap gap-2">
        {hubs.map((item) => <button key={item.hubId} type="button" role="tab" aria-selected={item.hubId === hubId} onClick={() => setHubId(item.hubId)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${item.hubId === hubId ? 'bg-[#087f6a] text-white' : 'bg-white text-[#17332f] hover:bg-[#e6f4ef]'}`}>{hubLabel(item)}</button>)}
      </div>
      <button type="button" onClick={() => { resetDemo(); setLastEvent('Đã nạp lại dữ liệu demo.') }}
        className="inline-flex items-center gap-2 rounded-lg border border-[#d7e2de] bg-white px-4 py-2 text-sm font-semibold text-[#17332f] hover:bg-[#f4f7f6]"><RotateCcw size={16} /> Nạp lại dữ liệu demo</button>
    </div>

    {hub && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[['Sức chứa', hub.totalSlots], ['Đang có xe', hub.occupiedSlots], ['Đang giữ chỗ', hub.heldSlots], ['Xe đang tới', hub.incomingReserved], ['Còn trống', availableCapacity(hub)]].map(([label, value]) =>
        <div key={label} className="rounded-2xl border border-[#e4ece9] bg-white p-4"><p className="text-sm text-[#5f716c]">{label}</p><p className="mt-1 text-2xl font-semibold text-[#17332f]">{value}</p></div>)}
    </div>}

    {lastEvent && <p role="status" className="rounded-xl bg-[#e6f4ef] px-4 py-3 text-sm text-[#087f6a]">{lastEvent}</p>}

    <Card>
      <CardTitle title={`Ô đỗ xe cá nhân · ${hub?.name ?? ''}`} subtitle={slots.length ? `${slots.length} ô có cảm biến` : 'Hub này chưa có ô đỗ xe cá nhân'} />
      <SlotGrid slots={slots} renderActions={(slot) => <div className="mt-2 space-y-1">
        <div className="flex gap-1">
          <button type="button" onClick={() => report(slot, 'OCCUPIED')} disabled={slot.status === 'OCCUPIED' || slot.status === 'UNAVAILABLE'}
            className="flex-1 rounded bg-white/80 px-1 py-0.5 text-[11px] font-semibold text-[#17332f] ring-1 ring-[#d7e2de] disabled:opacity-40" aria-label={`Xe vào ô ${slot.slotId}`}>Xe vào</button>
          <button type="button" onClick={() => report(slot, 'FREE')} disabled={slot.status !== 'OCCUPIED'}
            className="flex-1 rounded bg-white/80 px-1 py-0.5 text-[11px] font-semibold text-[#17332f] ring-1 ring-[#d7e2de] disabled:opacity-40" aria-label={`Xe rời ô ${slot.slotId}`}>Xe rời</button>
        </div>
        <select value={slot.sensorStatus} onChange={(event) => setSensorStatus(slot.slotId, event.target.value as ParkingSensorStatus)}
          className="w-full rounded bg-white px-1 py-0.5 text-[11px] text-[#17332f] ring-1 ring-[#d7e2de]" aria-label={`Cảm biến ô ${slot.slotId}`}>
          {(Object.keys(sensorLabel) as ParkingSensorStatus[]).map((status) => <option key={status} value={status}>{sensorLabel[status]}</option>)}
        </select>
      </div>} />
    </Card>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardTitle title="Đơn đặt chỗ tại Hub" subtitle="Mới nhất ở trên" />
        {hubReservations.length === 0 ? <p className="text-sm text-[#5f716c]">Chưa có đơn nào.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-[#5f716c]"><tr><th className="py-2">Mã đơn</th><th>Sinh viên</th><th>Trạng thái</th><th>Ô</th><th>Đến</th><th>Hạn</th></tr></thead>
            <tbody>{hubReservations.map((item) => <tr key={item.reservationId} className="border-t border-[#e4ece9]">
              <td className="py-2 font-semibold">{item.reservationId}</td><td>{item.studentId}</td>
              <td><StatusTag tone={reservationTone[item.status]}>{item.status.replaceAll('_', ' ')}</StatusTag></td>
              <td>{item.slotId ?? '—'}</td><td>{formatTime(item.arrivalTime)}</td>
              <td>{item.status === 'SLOT_ASSIGNED' ? formatTime(item.slotHoldExpiresAt) : formatTime(item.expiresAt)}</td>
            </tr>)}</tbody>
          </table></div>}
      </Card>
      <Card>
        <CardTitle title="Sự cố đang mở" action={<Link to="/operator" className="text-xs font-semibold text-[#087f6a] hover:underline">Dashboard</Link>} />
        {hubIncidents.length === 0 ? <p className="text-sm text-[#5f716c]">Không có sự cố.</p> :
          <ul className="space-y-2">{hubIncidents.map((item) => <li key={item.incidentId} className="rounded-lg bg-[#f4f7f6] p-3 text-sm">
            <p className="font-semibold text-[#17332f]">{item.title}</p><p className="text-xs text-[#5f716c]">{item.incidentId} · {item.severity} · {formatTime(item.createdAt)}</p>
          </li>)}</ul>}
      </Card>
    </div>
  </div>
}
