// Quản lý hàng đợi sạc · RES-03 (Figma Operations_Charging_Queue_Management_Screen 112:621)
import { useState } from 'react'
import { ArrowDown, ArrowUp, Wand2 } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { isHighPriority, orderChargingQueue, type MoveQueueResult } from '../../../store/chargingSlice'
import type { ChargingRequest } from '../../../types'
import { Button, Card, CardTitle, KpiCard, Notice, PageHeader, Pill, SmallLabel, inputClass, tableHeadClass } from '../../../components/shared/ui'
import { formatTime } from '../../../lib/format'
import { useNow } from '../../../lib/useNow'
import ResourceTabs from '../components/ResourceTabs'

const moveError: Record<Exclude<MoveQueueResult, { ok: true }>['reason'], string> = {
  NOT_IN_QUEUE: 'Yêu cầu không còn trong hàng đợi.',
  SAME_POSITION: 'Vị trí mới trùng vị trí hiện tại.',
  REASON_REQUIRED: 'Cần nhập lý do điều chỉnh (ít nhất 5 ký tự).',
  INVALID_POSITION: 'Vị trí mới không hợp lệ.',
}

export default function ChargingQueuePage() {
  const now = useNow()
  const hubs = useMobilityStore((s) => s.hubs)
  const requests = useMobilityStore((s) => s.chargingRequests)
  const points = useMobilityStore((s) => s.chargingPoints)
  const manualOrder = useMobilityStore((s) => s.chargingQueueOrder)
  const adjustments = useMobilityStore((s) => s.chargingQueueAdjustments)
  const move = useMobilityStore((s) => s.moveChargingRequest)
  const autoSchedule = useMobilityStore((s) => s.autoScheduleCharging)
  const schedule = useMobilityStore((s) => s.scheduleChargingRequest)
  const startCharging = useMobilityStore((s) => s.startCharging)
  const completeCharging = useMobilityStore((s) => s.completeCharging)
  const reschedule = useMobilityStore((s) => s.rescheduleChargingRequest)
  const [hubId, setHubId] = useState('ALL')
  const [priority, setPriority] = useState<'ALL' | 'HIGH' | 'NORMAL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [target, setTarget] = useState(1)
  const [reason, setReason] = useState('')
  const [pointId, setPointId] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const queue = orderChargingQueue(requests, manualOrder)
  const term = query.trim().toLowerCase()
  const visible = queue.map((request, index) => ({ request, position: index + 1 }))
    .filter(({ request }) => (hubId === 'ALL' || request.hubId === hubId)
      && (priority === 'ALL' || (priority === 'HIGH') === isHighPriority(request))
      && (!term || `${request.vehicleId} ${request.requestId}`.toLowerCase().includes(term)))
  const selected = queue.find((request) => request.requestId === selectedId) ?? visible[0]?.request
  const selectedPosition = selected ? queue.indexOf(selected) + 1 : 0
  const freePoints = selected ? points.filter((point) => point.hubId === selected.hubId && point.status === 'AVAILABLE') : []
  const active = requests.filter((request) => request.status === 'SCHEDULED' || request.status === 'CHARGING')
    .filter((request) => hubId === 'ALL' || request.hubId === hubId)
  const waitMinutes = (request: ChargingRequest) => Math.max(0, Math.floor((now - new Date(request.createdAt).getTime()) / 60000))
  const today = new Date(now).toDateString()
  const hubShort = (id: string) => hubs.find((hub) => hub.hubId === id)?.hubId ?? id

  const select = (request: ChargingRequest, position?: number) => {
    setSelectedId(request.requestId)
    setTarget(position ?? queue.indexOf(request) + 1)
    setPointId('')
    setMessage(undefined)
  }
  const confirmMove = () => {
    if (!selected) return
    const result = move(selected.requestId, target, reason)
    if (result.ok) { setMessage({ tone: 'success', text: `Đã chuyển ${selected.requestId} từ vị trí ${selectedPosition} sang ${target}. Thay đổi được lưu vào audit trail.` }); setReason('') }
    else setMessage({ tone: 'danger', text: moveError[result.reason] })
  }
  const assign = () => {
    if (!selected) return
    const chosen = pointId || freePoints[0]?.chargingPointId
    const result = chosen ? schedule(selected.requestId, chosen) : { ok: false as const }
    setMessage(result.ok ? { tone: 'success', text: `Đã gán ${chosen} cho ${selected.vehicleId}. Cổng ở trạng thái Đã gán cho đến khi xe kết nối.` } : { tone: 'danger', text: 'Không gán được: Hub không còn cổng trống.' })
  }

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Quản lý tài nguyên · RES-03" title="Quản lý hàng đợi sạc"
      subtitle="Theo dõi yêu cầu chờ sạc và điều chỉnh thứ tự thủ công; mọi thay đổi phải có lý do và được lưu audit trail." />
    <ResourceTabs />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Yêu cầu đang chờ" value={queue.length} hint="Trên toàn mạng lưới" hintTone="neutral" />
      <KpiCard label="Pin ≤20%" value={queue.filter(isHighPriority).length} hint="Được ưu tiên cao theo quy tắc" hintTone="neutral" />
      <KpiCard label="Cổng đã gán" value={points.filter((point) => point.status === 'ASSIGNED').length} hint="Chờ xe kết nối thực tế" hintTone="neutral" />
      <KpiCard label="Điều chỉnh hôm nay" value={adjustments.filter((item) => new Date(item.at).toDateString() === today).length} hint="Đều có lý do trong audit trail" hintTone="neutral" />
    </div>

    <Card className="!py-4">
      <div className="grid gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto] md:items-end">
        <label className="text-xs text-[#5f716c]">Hub<select value={hubId} onChange={(event) => setHubId(event.target.value)} className={`${inputClass} mt-1`}><option value="ALL">Tất cả Hub</option>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.hubId} · {hub.name}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className={`${inputClass} mt-1`}><option value="ALL">Tất cả mức</option><option value="HIGH">Cao (pin ≤20%)</option><option value="NORMAL">Thường</option></select></label>
        <label className="text-xs text-[#5f716c]">Tìm mã xe<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập mã xe hoặc mã yêu cầu..." className={`${inputClass} mt-1`} /></label>
        <button type="button" onClick={() => { const count = autoSchedule(); setMessage(count ? { tone: 'success', text: `Đã xếp lịch ${count} yêu cầu vào cổng trống theo thứ tự hàng đợi.` } : { tone: 'danger', text: 'Không có yêu cầu nào xếp được: các Hub có yêu cầu chờ đã hết cổng trống.' }) }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#087f6a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#066b59]"><Wand2 size={16} /> Xếp lịch tự động</button>
      </div>
    </Card>

    {message && <Notice tone={message.tone} title={message.text} />}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Danh sách yêu cầu chờ sạc" subtitle="Thứ tự hiện tại · Pin thấp và thời gian chờ được xét theo chính sách ưu tiên" />
          {visible.length === 0 ? <p className="text-sm text-[#5f716c]">Không có yêu cầu nào đang chờ.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
              <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Vị trí</th><th>Phương tiện</th><th>Pin</th><th>Chờ</th><th>Ưu tiên</th><th className="rounded-r-lg">Điều chỉnh</th></tr></thead>
              <tbody>{visible.map(({ request, position }) => <tr key={request.requestId} onClick={() => select(request)}
                className={`cursor-pointer border-b border-[#e4ece9] last:border-0 ${request.requestId === selected?.requestId ? 'bg-[#e6f4ef]' : 'hover:bg-[#f9fbfa]'}`}>
                <td className="px-3 py-4 text-base font-semibold">{String(position).padStart(2, '0')}</td>
                <td><p className="font-semibold">{request.vehicleId}</p><p className="text-xs text-[#5f716c]">{request.requestId} · {hubShort(request.hubId)}{request.source === 'STUDENT' && ' · xe cá nhân'}</p></td>
                <td><span className="font-semibold">{request.battery}%</span>{request.batteryVerified === false && <span className="block text-xs text-[#946013]">chưa xác minh</span>}</td>
                <td className="text-[#5f716c]">{waitMinutes(request)} phút</td>
                <td>{isHighPriority(request) ? <Pill tone="warn">Cao</Pill> : <Pill tone="neutral">Thường</Pill>}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button type="button" aria-label={`Đưa ${request.vehicleId} lên`} disabled={position === 1} onClick={(event) => { event.stopPropagation(); select(request, position - 1) }} className="rounded-full bg-[#f4f7f6] p-2 hover:bg-[#e6f4ef] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" aria-label={`Đưa ${request.vehicleId} xuống`} disabled={position === queue.length} onClick={(event) => { event.stopPropagation(); select(request, position + 1) }} className="rounded-full bg-[#f4f7f6] p-2 hover:bg-[#e6f4ef] disabled:opacity-30"><ArrowDown size={14} /></button>
                </td>
              </tr>)}</tbody>
            </table></div>}
          <p className="mt-4 text-xs text-[#5f716c]">Pin ≤20% → ưu tiên cao. Khi cùng mức pin, hệ thống xét thời gian chờ. Mức pin nhập tay chưa xác minh không được hưởng ưu tiên cao.</p>
          <p className="mt-2 text-xs text-[#5f716c]">Nút ↑ / ↓ chọn vị trí mới; yêu cầu sau điều chỉnh phải được xác nhận và ghi nhận người thực hiện.</p>
        </Card>

        <Card>
          <CardTitle title="Đã xếp lịch & đang sạc" subtitle="Cổng Đã gán chỉ chuyển sang Đang sạc khi xe kết nối" />
          {active.length === 0 ? <p className="text-sm text-[#5f716c]">Chưa có yêu cầu nào được xếp lịch.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
              <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Yêu cầu</th><th>Cổng</th><th>Bắt đầu</th><th>Trạng thái</th><th className="rounded-r-lg text-right">Thao tác</th></tr></thead>
              <tbody>{active.map((request) => <tr key={request.requestId} className="border-b border-[#e4ece9] last:border-0">
                <td className="px-3 py-3"><p className="font-semibold">{request.vehicleId}</p><p className="text-xs text-[#5f716c]">{request.requestId}</p></td>
                <td>{request.chargingPointId}</td><td className="text-[#5f716c]">{formatTime(request.scheduledStart)}</td>
                <td>{request.status === 'CHARGING' ? <Pill tone="success">Đang sạc</Pill> : <Pill tone="info">Đã xếp lịch</Pill>}</td>
                <td className="space-x-3 whitespace-nowrap text-right text-xs font-semibold">
                  {request.status === 'SCHEDULED' && <>
                    <button type="button" onClick={() => startCharging(request.requestId)} className="text-[#087f6a] hover:underline">Xe kết nối</button>
                    <button type="button" onClick={() => { reschedule(request.requestId); setMessage({ tone: 'success', text: `${request.requestId} quay lại hàng đợi, cổng ${request.chargingPointId} được nhả.` }) }} className="text-[#946013] hover:underline">Dời lịch</button>
                  </>}
                  {request.status === 'CHARGING' && <button type="button" onClick={() => completeCharging(request.requestId)} className="text-[#087f6a] hover:underline">Kết thúc sạc</button>}
                </td>
              </tr>)}</tbody>
            </table></div>}
        </Card>
      </div>

      <Card className="min-w-0">
        <CardTitle title="Điều chỉnh thứ tự thủ công" />
        {!selected ? <p className="text-sm text-[#5f716c]">Chọn một yêu cầu trong hàng đợi.</p> : <>
          <Pill tone="info">ĐANG CHỌN</Pill>
          <p className="mt-3 text-lg font-semibold text-[#17332f]">{selected.requestId}</p>
          <p className="mt-1 text-sm text-[#5f716c]">{selected.vehicleId} · Hub {hubShort(selected.hubId)} · vị trí {selectedPosition}</p>
          <p className="text-sm text-[#5f716c]">Pin {selected.battery}% · Chờ {waitMinutes(selected)} phút</p>
          <div className="mt-4 space-y-4 border-t border-[#e4ece9] pt-4">
            <label className="block"><SmallLabel>Vị trí mới</SmallLabel>
              <select value={target} onChange={(event) => setTarget(Number(event.target.value))} className={`${inputClass} mt-2`}>
                {queue.map((_, index) => <option key={index} value={index + 1}>{index + 1}{index === 0 ? ' · Ưu tiên đầu hàng đợi' : index + 1 === selectedPosition ? ' · Vị trí hiện tại' : ''}</option>)}
              </select></label>
            <label className="block"><SmallLabel>Lý do điều chỉnh · bắt buộc</SmallLabel>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Ví dụ: pin dưới 20%, cần ưu tiên an toàn vận hành..." className={`${inputClass} mt-2 resize-none`} /></label>
            {reason.trim().length >= 5 ? <Pill tone="success">ĐÃ CÓ LÝ DO</Pill> : <Pill tone="warn">CẦN CÓ LÝ DO</Pill>}
            <Button disabled={reason.trim().length < 5 || target === selectedPosition} onClick={confirmMove}>Xác nhận thay đổi thứ tự</Button>
          </div>
          <div className="mt-5 space-y-3 border-t border-[#e4ece9] pt-4">
            <SmallLabel>Gán cổng thủ công</SmallLabel>
            {freePoints.length === 0 ? <p className="text-sm text-[#5f716c]">Hub {hubShort(selected.hubId)} hiện không còn cổng trống.</p> : <>
              <select value={pointId} onChange={(event) => setPointId(event.target.value)} className={inputClass} aria-label="Chọn cổng sạc">
                {freePoints.map((point) => <option key={point.chargingPointId} value={point.chargingPointId}>{point.chargingPointId} · {point.powerKw} kW</option>)}
              </select>
              <Button variant="outline" onClick={assign}>Gán cổng cho {selected.vehicleId}</Button>
            </>}
          </div>
        </>}
        <div className="mt-5 border-t border-[#e4ece9] pt-4">
          <SmallLabel>Lịch sử điều chỉnh gần đây</SmallLabel>
          {adjustments.length === 0 ? <p className="mt-2 text-sm text-[#5f716c]">Chưa có điều chỉnh nào.</p> :
            <ul className="mt-2 space-y-3">{[...adjustments].reverse().slice(0, 5).map((item) => <li key={item.adjustmentId} className="text-sm">
              <p className="text-[#17332f]">{formatTime(item.at)} · {item.actor} · {item.requestId}: vị trí {item.fromPosition} → {item.toPosition}</p>
              <p className="text-xs text-[#5f716c]">Lý do: {item.reason}</p>
            </li>)}</ul>}
          <p className="mt-4 text-xs leading-5 text-[#5f716c]">Không cho phép xác nhận nếu thiếu lý do; lưu người thao tác, thời điểm, thứ tự cũ/mới và lý do.</p>
        </div>
      </Card>
    </div>
  </div>
}
