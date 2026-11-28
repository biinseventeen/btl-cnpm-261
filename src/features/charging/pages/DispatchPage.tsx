// Điều phối phương tiện giữa các Hub (Figma Operations_Redistribution_Screen 112:330)
import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { DISPATCH_RULES, dispatchEta, isDispatchEligible, type CreateDispatchResult } from '../../../store/chargingSlice'
import { HUB_ALERT_UTILIZATION, hubFreeSlots, hubUtilization } from '../../../store/storeUtils'
import { Button, Card, CardTitle, DetailRow, KpiCard, Notice, PageHeader, Pill, SmallLabel, inputClass, tableHeadClass } from '../../../components/shared/ui'
import { formatTime } from '../../../lib/format'
import { hubName, vehicleTypeLabel } from '../../../lib/labels'
import { useNow } from '../../../lib/useNow'

const createError = (result: Exclude<CreateDispatchResult, { ok: true }>) => {
  switch (result.reason) {
    case 'SAME_HUB': return 'Hub nguồn và Hub đích phải khác nhau.'
    case 'HUB_NOT_FOUND': return 'Không tìm thấy Hub.'
    case 'NO_VEHICLES': return 'Chọn ít nhất một xe để điều phối.'
    case 'DESTINATION_FULL': return 'Hub đích không đủ chỗ đỗ cho số xe đã chọn.'
    case 'BELOW_MIN_STOCK': return `Hub nguồn phải giữ lại tối thiểu ${DISPATCH_RULES.minSourceStock} xe sẵn sàng.`
    case 'VEHICLE_NOT_ELIGIBLE': return `Xe ${result.vehicleIds.join(', ')} không còn đủ điều kiện (đã được thuê, pin thấp hoặc mất kết nối). Danh sách đã được làm mới.`
  }
}

export default function DispatchPage() {
  const now = useNow()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const orders = useMobilityStore((s) => s.dispatchOrders)
  const create = useMobilityStore((s) => s.createDispatchOrder)
  const complete = useMobilityStore((s) => s.completeDispatchOrder)
  const cancel = useMobilityStore((s) => s.cancelDispatchOrder)
  // Default suggestion: the most loaded Hub sends to the least loaded one
  const byLoad = [...hubs].sort((a, b) => hubUtilization(b) - hubUtilization(a))
  const [sourceId, setSourceId] = useState(byLoad[0]?.hubId ?? '')
  const [destinationId, setDestinationId] = useState(byLoad.at(-1)?.hubId ?? '')
  const [picked, setPicked] = useState<string[]>([])
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string }>()

  const source = hubs.find((hub) => hub.hubId === sourceId)
  const destination = hubs.find((hub) => hub.hubId === destinationId)
  const eligible = vehicles.filter((vehicle) => vehicle.hubId === sourceId && isDispatchEligible(vehicle, now)).sort((a, b) => b.battery - a.battery)
  const chosen = picked.filter((id) => eligible.some((vehicle) => vehicle.vehicleId === id))
  const maxMovable = Math.max(0, eligible.length - DISPATCH_RULES.minSourceStock)
  const destinationFree = destination ? hubFreeSlots(destination) : 0
  const checks = [
    { ok: sourceId !== destinationId, text: 'Hub nguồn khác Hub đích' },
    { ok: chosen.length > 0, text: `Đã chọn ${chosen.length} xe` },
    { ok: eligible.length - chosen.length >= DISPATCH_RULES.minSourceStock, text: `Hub nguồn còn ${eligible.length - chosen.length} xe sẵn sàng (tối thiểu ${DISPATCH_RULES.minSourceStock})` },
    { ok: destinationFree >= chosen.length, text: `Hub đích còn ${destinationFree} chỗ trống` },
  ]
  const running = orders.filter((order) => order.status === 'IN_PROGRESS')
  const finished = orders.filter((order) => order.status !== 'IN_PROGRESS').slice(-5).reverse()

  const changeSource = (id: string) => { setSourceId(id); setPicked([]); setMessage(undefined) }
  const toggle = (id: string) => setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const submit = () => {
    const result = create({ sourceHubId: sourceId, destinationHubId: destinationId, vehicleIds: chosen })
    if (result.ok) { setMessage({ tone: 'success', text: `Đã tạo lệnh ${result.orderId}: ${chosen.length} xe ${hubName(hubs, sourceId)} → ${hubName(hubs, destinationId)}. Xe chuyển sang Đang điều phối.` }); setPicked([]) }
    else setMessage({ tone: 'danger', text: createError(result) })
  }

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Quản lý tài nguyên / Điều phối" title="Điều phối phương tiện giữa các Hub"
      subtitle="Chọn Hub nguồn, Hub đích và các xe đủ điều kiện. Hệ thống kiểm tra lại dữ liệu thật trước khi tạo lệnh." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Lệnh đang chạy" value={running.length} hint={`${running.reduce((sum, order) => sum + order.vehicleIds.length, 0)} xe đang trên đường`} hintTone="info" />
      <KpiCard label="Hub vượt ngưỡng" value={hubs.filter((hub) => hubUtilization(hub) >= HUB_ALERT_UTILIZATION).length} hint={`Mức sử dụng ≥ ${HUB_ALERT_UTILIZATION}%`} hintTone="warn" />
      <KpiCard label="Xe đủ điều kiện tại nguồn" value={eligible.length} hint={`Tối đa điều được ${maxMovable} xe`} hintTone="neutral" />
      <KpiCard label="Thời gian di chuyển" value={`${DISPATCH_RULES.travelMinutes} phút`} hint="Ước tính mỗi lệnh" hintTone="neutral" />
    </div>

    {message && <Notice tone={message.tone} title={message.text} />}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Thiết lập điều phối" />
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <label className="text-xs text-[#5f716c]">Hub nguồn<select value={sourceId} onChange={(event) => changeSource(event.target.value)} className={`${inputClass} mt-1`}>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.name} · {hubUtilization(hub)}%</option>)}</select></label>
            <ArrowRight size={18} className="mb-3 hidden text-[#5f716c] sm:block" />
            <label className="text-xs text-[#5f716c]">Hub đích<select value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setMessage(undefined) }} className={`${inputClass} mt-1`}>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.name} · còn {hubFreeSlots(hub)} chỗ</option>)}</select></label>
          </div>
        </Card>

        <Card>
          <CardTitle title="Xe đủ điều kiện tại Hub nguồn" subtitle={`Sẵn sàng, pin trên 20%, heartbeat còn hiệu lực · ${source?.name ?? ''}`}
            action={eligible.length > 0 && <button type="button" onClick={() => setPicked(eligible.slice(0, maxMovable).map((vehicle) => vehicle.vehicleId))} className="text-sm font-semibold text-[#087f6a] hover:underline">Chọn tối đa ({maxMovable})</button>} />
          {eligible.length === 0 ? <p className="text-sm text-[#5f716c]">Hub này không có xe đủ điều kiện.</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
              <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Chọn</th><th>Mã xe</th><th>Loại</th><th className="rounded-r-lg">Pin</th></tr></thead>
              <tbody>{eligible.map((vehicle) => <tr key={vehicle.vehicleId} onClick={() => toggle(vehicle.vehicleId)} className={`cursor-pointer border-b border-[#e4ece9] last:border-0 ${chosen.includes(vehicle.vehicleId) ? 'bg-[#e6f4ef]' : 'hover:bg-[#f9fbfa]'}`}>
                <td className="px-3 py-3"><input type="checkbox" readOnly checked={chosen.includes(vehicle.vehicleId)} aria-label={`Chọn ${vehicle.vehicleId}`} className="h-4 w-4 accent-[#087f6a]" /></td>
                <td className="font-semibold">{vehicle.vehicleId}</td><td className="text-[#5f716c]">{vehicleTypeLabel(vehicle)}</td><td className="font-semibold">{vehicle.battery}%</td>
              </tr>)}</tbody>
            </table></div>}
        </Card>

        <Card>
          <CardTitle title="Lệnh điều phối đang chạy" subtitle="Xác nhận bàn giao khi xe đã tới Hub đích" />
          {running.length === 0 ? <p className="text-sm text-[#5f716c]">Chưa có lệnh nào đang chạy.</p> :
            <ul>{running.map((order) => <li key={order.orderId} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ece9] py-4 last:border-0">
              <div><p className="font-semibold text-[#17332f]">{order.orderId} {order.origin === 'SIMULATION' && <Pill tone="purple">Từ mô phỏng</Pill>}</p>
                <p className="mt-1 text-sm text-[#5f716c]">{hubName(hubs, order.sourceHubId)} → {hubName(hubs, order.destinationHubId)} · {order.vehicleIds.length} xe · dự kiến tới {formatTime(dispatchEta(order))}</p>
                <p className="mt-1 text-xs text-[#5f716c]">{order.vehicleIds.join(', ')}</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { complete(order.orderId); setMessage({ tone: 'success', text: `${order.orderId}: đã bàn giao ${order.vehicleIds.length} xe tại ${hubName(hubs, order.destinationHubId)}.` }) }} className="inline-flex items-center gap-1 rounded-lg bg-[#087f6a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#066b59]"><Check size={14} /> Xác nhận bàn giao</button>
                <button type="button" onClick={() => { cancel(order.orderId); setMessage({ tone: 'success', text: `${order.orderId} đã hủy, xe trở lại Hub nguồn.` }) }} className="inline-flex items-center gap-1 rounded-lg border border-[#d7e2de] px-3 py-2 text-xs font-semibold text-[#b42318] hover:bg-[#fde8e6]"><X size={14} /> Hủy</button>
              </div>
            </li>)}</ul>}
          {finished.length > 0 && <div className="mt-4 border-t border-[#e4ece9] pt-4"><SmallLabel>Gần đây</SmallLabel>
            {finished.map((order) => <DetailRow key={order.orderId} label={`${order.orderId} · ${hubName(hubs, order.sourceHubId)} → ${hubName(hubs, order.destinationHubId)}`} value={order.status === 'COMPLETED' ? `Đã bàn giao ${formatTime(order.completedAt)}` : 'Đã hủy'} />)}</div>}
        </Card>
      </div>

      <aside className="min-w-0 space-y-6">
        <Card tone="success">
          <CardTitle title="Tóm tắt lệnh" />
          <DetailRow label="Hub nguồn" value={source?.name ?? '—'} />
          <DetailRow label="Hub đích" value={destination?.name ?? '—'} />
          <DetailRow label="Số xe" value={chosen.length} />
          <DetailRow label="Dự kiến tới" value={formatTime(new Date(now + DISPATCH_RULES.travelMinutes * 60000).toISOString())} />
          <div className="mt-4 space-y-2">{checks.map((check) => <p key={check.text} className={`flex items-center gap-2 text-sm ${check.ok ? 'text-[#087f6a]' : 'text-[#b42318]'}`}>{check.ok ? <Check size={15} /> : <X size={15} />}{check.text}</p>)}</div>
          <Button className="mt-4" disabled={!checks.every((check) => check.ok)} onClick={submit}>Tạo lệnh điều phối</Button>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">Khi tạo lệnh, xe chuyển sang Đang điều phối, Hub nguồn giảm chỗ đang đỗ và Hub đích giữ trước chỗ cho xe đang tới.</p>
        </Card>
        <Card>
          <CardTitle title="Mức sử dụng Hub" />
          {hubs.map((hub) => <DetailRow key={hub.hubId} label={hub.name} value={<span className={hubUtilization(hub) >= HUB_ALERT_UTILIZATION ? 'text-[#946013]' : ''}>{hubUtilization(hub)}% · {hubFreeSlots(hub)} chỗ trống</span>} />)}
        </Card>
        <p className="text-xs leading-5 text-[#5f716c]">Xe mất kết nối, pin ≤20% hoặc đang được giữ không xuất hiện trong danh sách.</p>
      </aside>
    </div>
  </div>
}
