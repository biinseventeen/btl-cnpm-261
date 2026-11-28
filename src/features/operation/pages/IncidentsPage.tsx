// Sự cố vận hành (Figma Operations_Incident_Management_Screen 26:181)
import { useState } from 'react'
import { Search } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { SEVERITY_RANK } from '../../../store/operationSlice'
import type { IncidentSeverity, OperationalIncident } from '../../../types'
import { Button, Card, CardTitle, DetailRow, KpiCard, Notice, PageHeader, Pill, SmallLabel, inputClass, tableHeadClass } from '../../../components/shared/ui'
import { formatDateTime, formatTime, hubLabel } from '../../../lib/format'
import { assetKindLabel, incidentStage, incidentStageView, severityView, vehicleTypeLabel, type AssetKind, type IncidentStage } from '../../../lib/labels'
import { useNow } from '../../../lib/useNow'

const STEPS: { stage: IncidentStage[]; title: string; text: string }[] = [
  { stage: ['NEW'], title: '01 · Ghi nhận', text: 'Tự động phát hiện / báo cáo' },
  { stage: ['WAITING_TECH'], title: '02 · Cô lập', text: 'Tạm khóa xe hoặc cổng lỗi' },
  { stage: ['IN_PROGRESS'], title: '03 · Khắc phục', text: 'Gửi đội kỹ thuật và theo dõi' },
  { stage: ['RESOLVED'], title: '04 · Xác minh', text: 'Cập nhật trạng thái sau sửa' },
]

type StatusFilter = 'OPEN' | 'ALL' | IncidentStage

export default function IncidentsPage() {
  const now = useNow()
  const hubs = useMobilityStore((s) => s.hubs)
  const incidents = useMobilityStore((s) => s.incidents)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const points = useMobilityStore((s) => s.chargingPoints)
  const slots = useMobilityStore((s) => s.parkingSlots)
  const notify = useMobilityStore((s) => s.notifyTechnician)
  const acknowledge = useMobilityStore((s) => s.acknowledgeIncident)
  const restore = useMobilityStore((s) => s.restoreIncidentAsset)
  const [hubFilter, setHubFilter] = useState('ALL')
  const [kindFilter, setKindFilter] = useState<'ALL' | AssetKind>('ALL')
  const [severityFilter, setSeverityFilter] = useState<'ALL' | IncidentSeverity>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const [showHistory, setShowHistory] = useState(false)
  const [feedback, setFeedback] = useState<string>()

  const assetKind = (incident: OperationalIncident): AssetKind =>
    vehicles.some((item) => item.vehicleId === incident.assetId) ? 'VEHICLE'
      : points.some((item) => item.chargingPointId === incident.assetId) ? 'CHARGING_POINT'
        : slots.some((item) => item.slotId === incident.assetId) ? 'PARKING_SLOT' : 'HUB'
  const assetLabel = (incident: OperationalIncident) => {
    const vehicle = vehicles.find((item) => item.vehicleId === incident.assetId)
    return vehicle ? `${vehicle.vehicleId} · ${vehicleTypeLabel(vehicle)}` : `${incident.assetId} · ${assetKindLabel[assetKind(incident)]}`
  }
  const assetBlocked = (incident: OperationalIncident) => {
    const vehicle = vehicles.find((item) => item.vehicleId === incident.assetId)
    if (vehicle) return vehicle.status === 'UNAVAILABLE' || vehicle.status === 'DISCONNECTED'
    const point = points.find((item) => item.chargingPointId === incident.assetId)
    if (point) return point.status === 'ERROR'
    const slot = slots.find((item) => item.slotId === incident.assetId)
    return slot ? slot.status === 'UNAVAILABLE' || slot.sensorStatus !== 'ONLINE' : false
  }

  const term = query.trim().toLowerCase()
  const filtered = incidents
    .filter((incident) => hubFilter === 'ALL' || incident.hubId === hubFilter)
    .filter((incident) => kindFilter === 'ALL' || assetKind(incident) === kindFilter)
    .filter((incident) => severityFilter === 'ALL' || incident.severity === severityFilter)
    .filter((incident) => statusFilter === 'ALL' || (statusFilter === 'OPEN' ? incident.status !== 'RESOLVED' : incidentStage(incident) === statusFilter))
    .filter((incident) => !term || `${incident.incidentId} ${incident.assetId} ${incident.title}`.toLowerCase().includes(term))
    .sort((a, b) => Number(a.status === 'RESOLVED') - Number(b.status === 'RESOLVED') || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt))
  const selected = incidents.find((incident) => incident.incidentId === selectedId) ?? filtered[0]
  const open = incidents.filter((incident) => incident.status !== 'RESOLVED')
  const today = new Date(now).toDateString()
  const resolvedToday = incidents.filter((incident) => incident.resolvedAt && new Date(incident.resolvedAt).toDateString() === today).length
  const stage = selected ? incidentStage(selected) : undefined
  const syncLabel = (incident: OperationalIncident) => {
    const lastAt = incident.history?.at(-1)?.at ?? incident.createdAt
    const seconds = Math.max(0, Math.round((now - new Date(lastAt).getTime()) / 1000))
    return seconds < 60 ? `Đã cập nhật · ${seconds} giây` : `Đã cập nhật lúc ${formatTime(lastAt)}`
  }

  const run = (action: () => { ok: boolean; summary?: string }, success: string) => {
    const result = action()
    setFeedback(result.ok ? result.summary ?? success : 'Thao tác không hợp lệ với trạng thái hiện tại của sự cố.')
  }
  const clearFilters = () => { setHubFilter('ALL'); setKindFilter('ALL'); setSeverityFilter('ALL'); setStatusFilter('OPEN'); setQuery('') }

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Quản lý vận hành / Incident management" title="Sự cố vận hành"
      subtitle="Theo dõi, phân loại và xử lý sự cố phương tiện, cổng sạc hoặc kết nối Hub." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Sự cố đang mở" value={String(open.length).padStart(2, '0')} hint="Cần theo dõi trong ca trực" hintTone="warn" />
      <KpiCard label="Mức nghiêm trọng" value={String(open.filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH').length).padStart(2, '0')} hint="Cao hoặc nghiêm trọng · ảnh hưởng phục vụ" hintTone="danger" />
      <KpiCard label="Chờ đội kỹ thuật" value={String(open.filter((item) => incidentStage(item) === 'WAITING_TECH').length).padStart(2, '0')} hint="Đã gửi yêu cầu kiểm tra" hintTone="info" />
      <KpiCard label="Đã xử lý hôm nay" value={String(resolvedToday).padStart(2, '0')} hint="Có lưu lịch sử xử lý" />
    </div>

    <Card className="!py-4">
      <SmallLabel>Bộ lọc</SmallLabel>
      <div className="mt-2 grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)_auto] md:items-end">
        <label className="text-xs text-[#5f716c]">Hub<select value={hubFilter} onChange={(event) => setHubFilter(event.target.value)} className={`${inputClass} mt-1`}><option value="ALL">Tất cả Hub</option>{hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.name}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Loại<select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)} className={`${inputClass} mt-1`}><option value="ALL">Tất cả loại sự cố</option>{(Object.keys(assetKindLabel) as AssetKind[]).map((kind) => <option key={kind} value={kind}>{assetKindLabel[kind]}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Mức độ<select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)} className={`${inputClass} mt-1`}><option value="ALL">Tất cả mức độ</option>{(Object.keys(severityView) as IncidentSeverity[]).map((severity) => <option key={severity} value={severity}>{severityView[severity].label}</option>)}</select></label>
        <label className="text-xs text-[#5f716c]">Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={`${inputClass} mt-1`}><option value="OPEN">Đang mở</option><option value="ALL">Tất cả</option>{(Object.keys(incidentStageView) as IncidentStage[]).map((item) => <option key={item} value={item}>{incidentStageView[item].label}</option>)}</select></label>
        <div className="relative"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã sự cố / tài nguyên" aria-label="Tìm mã sự cố hoặc tài nguyên" className={`${inputClass} pl-9`} /><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f716c]" /></div>
        <button type="button" onClick={clearFilters} className="py-2.5 text-sm font-semibold text-[#087f6a] hover:underline">Xóa lọc</button>
      </div>
    </Card>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <Card className="min-w-0">
        <CardTitle title="Danh sách sự cố" subtitle="Sắp xếp theo mức ưu tiên và thời điểm phát hiện" />
        {filtered.length === 0 ? <p className="text-sm text-[#5f716c]">Không có sự cố nào khớp bộ lọc.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
            <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Mã / Tài nguyên</th><th>Sự cố</th><th>Mức độ</th><th className="rounded-r-lg">Trạng thái</th></tr></thead>
            <tbody>{filtered.map((incident) => {
              const active = incident.incidentId === selected?.incidentId
              return <tr key={incident.incidentId} onClick={() => { setSelectedId(incident.incidentId); setShowHistory(false); setFeedback(undefined) }}
                className={`cursor-pointer border-b border-[#e4ece9] last:border-0 ${active ? 'bg-[#e6f4ef]' : 'hover:bg-[#f9fbfa]'}`}>
                <td className="px-3 py-4"><p className="text-xs font-semibold text-[#087f6a]">{incident.incidentId}</p><p className="mt-1 font-semibold">{incident.assetId}</p></td>
                <td><p className="font-medium">{incident.title}</p><p className="mt-1 text-xs text-[#5f716c]">{hubs.find((hub) => hub.hubId === incident.hubId)?.name}</p></td>
                <td><Pill tone={severityView[incident.severity].tone}>{severityView[incident.severity].label}</Pill></td>
                <td><Pill tone={incidentStageView[incidentStage(incident)].tone}>{incidentStageView[incidentStage(incident)].label}</Pill></td>
              </tr>
            })}</tbody>
          </table></div>}
        <p className="mt-4 text-xs text-[#5f716c]">Mốc phản ánh sự cố lên dashboard: trong vòng ≤ 10 giây từ khi hệ thống ghi nhận.</p>
      </Card>

      <Card className="min-w-0">
        <CardTitle title="Chi tiết sự cố" />
        {!selected ? <p className="text-sm text-[#5f716c]">Chọn một sự cố để xem chi tiết.</p> : <>
          <div className="flex flex-wrap gap-2"><Pill tone={severityView[selected.severity].tone}>{severityView[selected.severity].label.toUpperCase()}</Pill><Pill tone={incidentStageView[stage!].tone}>{incidentStageView[stage!].label.toUpperCase()}</Pill></div>
          <p className="mt-4 text-xl font-semibold text-[#17332f]">{selected.incidentId} · {selected.assetId}</p>
          <p className="mt-1 text-sm text-[#5f716c]">{selected.title}.</p>
          <div className="mt-4">
            <DetailRow label="Tài nguyên" value={assetLabel(selected)} />
            <DetailRow label="Hub hiện tại" value={hubLabel(hubs.find((hub) => hub.hubId === selected.hubId))} />
            <DetailRow label="Mã lỗi" value={selected.faultCode ?? '—'} />
            <DetailRow label="Phát hiện lúc" value={formatDateTime(selected.createdAt)} />
            <DetailRow label="Tác động" value={assetBlocked(selected) ? 'Tài nguyên tạm khóa' : 'Không khóa tài nguyên'} />
            <DetailRow label="Đồng bộ dashboard" value={syncLabel(selected)} />
          </div>
          {feedback && <div className="mt-4"><Notice tone="success" title={feedback} /></div>}
          <SmallLabel><span className="mt-5 block">Hành động đề xuất</span></SmallLabel>
          <div className="mt-3 space-y-3">
            <Button disabled={selected.status === 'RESOLVED' || !!selected.technicianNotifiedAt} onClick={() => run(() => notify(selected.incidentId), 'Đã gửi thông báo cho đội kỹ thuật.')}>
              {selected.technicianNotifiedAt ? `Đã báo đội kỹ thuật lúc ${formatTime(selected.technicianNotifiedAt)}` : 'Gửi thông báo đội kỹ thuật'}</Button>
            <Button variant="outline" disabled={selected.status !== 'OPEN'} onClick={() => run(() => acknowledge(selected.incidentId), 'Sự cố chuyển sang Đang xử lý.')}>Xác nhận đang xử lý</Button>
            <Button disabled={selected.status !== 'IN_PROGRESS'} onClick={() => run(() => restore(selected.incidentId), 'Đã khôi phục tài nguyên.')}>Xác nhận đã sửa chữa / Khôi phục tài nguyên</Button>
            <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử / audit trail'}</Button>
          </div>
          {showHistory && <ol className="mt-4 space-y-3 border-l-2 border-[#e4ece9] pl-4">
            {(selected.history ?? []).map((entry, index) => <li key={index} className="text-sm"><p className="text-xs text-[#5f716c]">{formatDateTime(entry.at)}</p><p className="text-[#17332f]">{entry.action}</p></li>)}
          </ol>}
          <p className="mt-4 rounded-lg bg-[#fff4df] px-3 py-2 text-xs text-[#946013]">Chỉ khôi phục khi đội kỹ thuật xác nhận đã sửa và tài nguyên vượt qua bước kiểm tra (sự cố phải ở trạng thái Đang xử lý).</p>
        </>}
      </Card>
    </div>

    <Card>
      <CardTitle title="Quy trình xử lý" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step) => {
          const current = stage && step.stage.includes(stage)
          return <div key={step.title} className={`rounded-xl p-4 ${current ? 'bg-[#e6f4ef] ring-1 ring-[#087f6a]' : 'bg-[#f4f7f6]'}`}>
            <p className="text-sm font-semibold text-[#087f6a]">{step.title}</p><p className="mt-1 text-xs text-[#5f716c]">{step.text}</p>
          </div>
        })}
      </div>
    </Card>
  </div>
}
