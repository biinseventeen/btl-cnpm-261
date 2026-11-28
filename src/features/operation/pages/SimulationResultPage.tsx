// Khuyến nghị điều phối sau mô phỏng: SIM-03_v2 (Figma 148:2) and the stale case SIM-03 (Figma 148:311)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeftRight, ArrowRight, ChevronRight, CircleAlert, FlaskConical, PlugZap, Signpost } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import type { RecommendationDecision } from '../../../store/operationSlice'
import { HUB_ALERT_UTILIZATION } from '../../../store/storeUtils'
import type { SimulationHubResult, SimulationRecommendation } from '../../../types'
import { Card, CardTitle, Checkbox, DemoButton, DemoPanel, KpiCard, Notice, PageHeader, Pill, inputClass, tableHeadClass, type PillTone } from '../../../components/shared/ui'
import { formatDate, formatTime, hubLabel } from '../../../lib/format'
import { hubName } from '../../../lib/labels'
import { useNow } from '../../../lib/useNow'
import { formatDemand, otherScenarios, scenarioLabel } from '../simulation'

const kindIcon = { DISPATCH: ArrowLeftRight, CHARGING_PRIORITY: PlugZap, REDIRECT: Signpost }
const proposedTag: Record<SimulationRecommendation['kind'], { label: string; tone: PillTone }> = {
  DISPATCH: { label: 'Khả thi trong ảnh chụp', tone: 'success' },
  CHARGING_PRIORITY: { label: 'Kiểm tra an toàn trước gán', tone: 'warn' },
  REDIRECT: { label: 'Không kết thúc tại Hub đầy', tone: 'warn' },
}
const pct = (parked: number, total: number) => `${Math.max(0, parked)}/${total} · ${Math.round((Math.max(0, parked) / Math.max(1, total)) * 100)}%`

export default function SimulationResultPage() {
  const now = useNow()
  const navigate = useNavigate()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const run = useMobilityStore((s) => s.simulationRun)
  const apply = useMobilityStore((s) => s.applySimulationRecommendations)
  const walkIn = useMobilityStore((s) => s.simulateWalkInRentals)
  const [selected, setSelected] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [decisions, setDecisions] = useState<RecommendationDecision[]>()
  const [walkInNote, setWalkInNote] = useState<string>()

  if (!run || run.status !== 'COMPLETED') {
    return <Card><CardTitle title="Chưa có kết quả mô phỏng" subtitle="Chạy một kịch bản để xem tác động và khuyến nghị điều phối." />
      <Link to="/operator/simulation" className="text-sm font-semibold text-[#087f6a] hover:underline">Mở cấu hình mô phỏng</Link></Card>
  }

  const { params } = run
  const focus = run.hubResults.find((item) => item.hubId === params.hubId)!
  const dispatch = run.recommendations.find((item) => item.kind === 'DISPATCH')
  const moved = dispatch?.vehicleIds?.length ?? 0
  const overloaded = (field: 'snapshotParked' | 'afterPlanParked') => run.hubResults.filter((item) => item[field] / Math.max(1, item.totalSlots) * 100 >= HUB_ALERT_UTILIZATION).length
  const chartHubs = [focus, ...run.hubResults.filter((item) => item.hubId !== focus.hubId)
    .sort((a, b) => Math.abs(b.afterPlanAvailable - b.snapshotAvailable) - Math.abs(a.afterPlanAvailable - a.snapshotAvailable) || b.snapshotAvailable - a.snapshotAvailable)].slice(0, 3)
  const chartMax = Math.max(1, ...chartHubs.flatMap((item) => [item.snapshotAvailable, item.afterDemandAvailable, item.afterPlanAvailable]))
  const stale = run.recommendations.filter((item) => item.status === 'STALE')
  const proposed = run.recommendations.filter((item) => item.status === 'PROPOSED')
  const snapshotTime = formatTime(run.snapshotAt)
  const evaluation = (item: SimulationHubResult) => {
    if (dispatch && item.hubId === dispatch.destinationHubId) return `Đủ chỗ nhận ${moved} xe`
    if (dispatch && item.hubId === dispatch.sourceHubId) return `Nguồn bù ${moved} xe`
    if (item.afterPlanParked >= item.totalSlots) return 'Đầy · chuyển hướng'
    return 'Không điều chỉnh'
  }
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const confirm = () => {
    setDecisions(apply(selected))
    setSelected([])
    setConfirmed(false)
  }
  const appliedDispatch = decisions?.some((decision) => decision.status === 'APPLIED' && run.recommendations.find((item) => item.recommendationId === decision.recommendationId)?.kind === 'DISPATCH')

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Phòng mô phỏng / Không gian độc lập" title="Khuyến nghị điều phối sau mô phỏng"
      subtitle="Tổng hợp khuyến nghị điều phối, tác động dự kiến và bước xác nhận áp dụng sau mô phỏng." />

    <div className="flex gap-3 rounded-2xl bg-[#edf4fa] px-5 py-4 text-[#2b5f8e]">
      <CircleAlert size={18} className="mt-0.5 shrink-0" />
      <div><p className="text-sm font-semibold">Kết quả mô phỏng · Đã hoàn tất, sẵn sàng xem xét điều phối</p>
        <p className="mt-1 text-sm text-[#17332f]">Snapshot {run.snapshotId} · {formatDate(run.snapshotAt)} {snapshotTime} · {hubs.length} Hub / {vehicles.length} xe. Mô phỏng đã tính trên ảnh chụp độc lập, không thay đổi dữ liệu vận hành và không tự áp dụng khuyến nghị.</p></div>
    </div>

    {decisions && decisions.length > 0 && <Notice tone={decisions.every((item) => item.status === 'APPLIED') ? 'success' : 'warn'} title={`Đã xử lý ${decisions.length} khuyến nghị`}>
      {decisions.map((item) => <span key={item.recommendationId} className="block">{item.recommendationId}: {item.status === 'APPLIED' ? 'đã áp dụng vào dữ liệu thật' : `bị từ chối · ${item.reason}`}</span>)}
      {appliedDispatch && <Link to="/operator/dispatch" className="mt-1 inline-block font-semibold underline">Xem lệnh điều phối vừa tạo</Link>}
    </Notice>}

    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Tóm tắt kịch bản đã chạy" subtitle={`${run.runId} · ${scenarioLabel[params.scenario]} ${formatDemand(params.demandChangePct)} trong ${params.durationMinutes} phút`} />
          <div className="space-y-3 text-sm">
            {[['Kịch bản', scenarioLabel[params.scenario]], ['Hub ảnh hưởng', hubLabel(hubs.find((hub) => hub.hubId === params.hubId))]].map(([label, value]) =>
              <div key={label}><p className="mb-1 text-xs font-medium text-[#17332f]">{label}</p><p className={`${inputClass} bg-[#f9fbfa]`}>{value}</p></div>)}
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1 text-xs font-medium text-[#17332f]">Mức tăng</p><p className={`${inputClass} bg-[#f9fbfa]`}>{formatDemand(params.demandChangePct)}</p></div>
              <div><p className="mb-1 text-xs font-medium text-[#17332f]">Thời gian</p><p className={`${inputClass} bg-[#f9fbfa]`}>{params.durationMinutes} phút</p></div>
            </div>
            <div><p className="mb-1 text-xs font-medium text-[#17332f]">Khung giờ giả lập</p><p className={`${inputClass} bg-[#f9fbfa]`}>{formatTime(params.windowStart)}–{formatTime(new Date(new Date(params.windowStart).getTime() + params.durationMinutes * 60000).toISOString())} · {formatDate(params.windowStart).slice(0, 5)}</p></div>
            <div><p className="mb-1 text-xs font-medium text-[#17332f]">Lượt xe thêm</p><p className={`${inputClass} bg-[#f9fbfa]`}>{params.extraTrips} lượt tại {hubName(hubs, params.hubId)}</p></div>
          </div>
          <button type="button" onClick={() => navigate('/operator/simulation', { state: { preset: params } })} className="mt-4 w-full rounded-lg border border-[#d7e2de] bg-white px-4 py-3 text-sm font-semibold text-[#17332f] hover:bg-[#f4f7f6]">Xem lại kịch bản</button>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">Mô phỏng đã hoàn tất. Dữ liệu trên chỉ dùng để xem xét khuyến nghị điều phối; cần kiểm tra lại trạng thái vận hành trước khi áp dụng.</p>
        </Card>
        <Card>
          <CardTitle title="Kịch bản khác" />
          <div className="space-y-2">{otherScenarios.map((item) => <button key={item.scenario} type="button" onClick={() => navigate('/operator/simulation', { state: { preset: { ...item.preset, scenario: item.scenario } } })}
            className="flex w-full items-center justify-between gap-3 rounded-lg bg-[#f4f7f6] px-3 py-3 text-left text-sm text-[#17332f] hover:bg-[#eaf0ee]">
            <span className="flex items-center gap-2"><FlaskConical size={15} className="text-[#087f6a]" />{item.title}</span><ChevronRight size={15} className="text-[#5f716c]" /></button>)}</div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard label={`Xe ${hubName(hubs, params.hubId)} sau kịch bản`} value={focus.afterDemandAvailable} hint={`Từ ${focus.snapshotAvailable} · trước điều chỉnh`} hintTone="warn" />
          <KpiCard label="Sau phương án đề xuất" value={focus.afterPlanAvailable} hint={moved ? `Bù ${moved} xe · có xét chỗ đỗ` : 'Không cần điều phối xe'} />
          <KpiCard label="Hub quá tải đỗ sau phương án" value={overloaded('afterPlanParked')} hint={`So với ${overloaded('snapshotParked')} Hub ở snapshot`} hintTone="warn" />
        </div>

        <Card>
          <CardTitle title="Kết quả mô phỏng · Số xe khả dụng" subtitle="Snapshot / sau kịch bản / sau khuyến nghị · kết quả giả lập cùng cấu hình" />
          <div className="mb-4 flex gap-2"><Pill tone="success">Hoàn tất trong {Math.max(1, Math.round(run.estimatedSeconds))}s</Pill><Pill tone="info">Kết quả mô phỏng</Pill></div>
          <div className="space-y-5">{chartHubs.map((item) => <div key={item.hubId}>
            <p className="text-sm font-semibold text-[#17332f]">{hubName(hubs, item.hubId)}</p>
            {([['Ảnh chụp', item.snapshotAvailable, '#5f716c'], ['Sau kịch bản', item.afterDemandAvailable, '#946013'], ['Có khuyến nghị', item.afterPlanAvailable, '#087f6a']] as const).map(([label, value, color]) =>
              <div key={label} className="mt-1.5 grid grid-cols-[110px_1fr] items-center gap-3 text-xs text-[#5f716c]">
                <span>{label}</span>
                <span className="flex items-center gap-2"><span className="h-3 rounded" style={{ width: `${Math.max(2, (Math.max(0, value) / chartMax) * 70)}%`, backgroundColor: color }} /><span className="font-semibold text-[#17332f]">{value}</span></span>
              </div>)}
          </div>)}</div>
          <p className="mt-4 text-xs text-[#5f716c]">Đơn vị: xe khả dụng · các kết quả là mô phỏng, không phải dự báo thực tế.</p>
        </Card>

        <Card>
          <CardTitle title="Tác động dự kiến lên năng lực Hub" subtitle={`Đỗ sau ${params.durationMinutes} phút, trước và sau áp dụng khuyến nghị trong mô phỏng`} />
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
            <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Hub</th><th>Sau kịch bản</th><th>Sau phương án</th><th className="rounded-r-lg">Đánh giá</th></tr></thead>
            <tbody>{run.hubResults.map((item) => <tr key={item.hubId} className="border-b border-[#e4ece9] last:border-0">
              <td className="px-3 py-3 font-semibold">{hubName(hubs, item.hubId)}</td>
              <td className={item.afterDemandParked >= item.totalSlots ? 'text-[#b42318]' : ''}>{pct(item.afterDemandParked, item.totalSlots)}</td>
              <td>{pct(item.afterPlanParked, item.totalSlots)}</td><td>{evaluation(item)}</td>
            </tr>)}</tbody>
          </table></div>
          {dispatch && <p className="mt-3 text-xs leading-5 text-[#5f716c]">Phương án {run.runId}: chỉ chuyển {moved} xe {hubName(hubs, dispatch.sourceHubId)} → {hubName(hubs, dispatch.destinationHubId)}. Kết quả này chỉ dùng để xem xét khuyến nghị; cần kiểm tra lại trạng thái vận hành thực trước khi áp dụng.</p>}
        </Card>
      </div>
    </div>

    <Card>
      <CardTitle title="Khuyến nghị điều phối sau mô phỏng" subtitle={`Mỗi khuyến nghị gắn với snapshot ${run.snapshotId} (${snapshotTime}) và các điều kiện tiên quyết. Mô phỏng không giữ xe, chỗ đỗ hay cổng sạc nào.`} />
      {stale.map((item) => <div key={item.recommendationId} role="alert" className="mb-4 flex gap-3 rounded-xl bg-[#fde8e6] p-4 text-[#b42318]">
        <CircleAlert size={18} className="mt-0.5 shrink-0" />
        <div><p className="text-sm font-semibold uppercase">Không áp dụng được {item.recommendationId} · Khuyến nghị đã cũ</p>
          <p className="mt-1 text-sm">Dữ liệu thật đã thay đổi sau snapshot {snapshotTime}: {item.staleReason}.{proposed.length > 0 && ` ${proposed.map((other) => other.recommendationId).join(' và ')} vẫn chờ xét duyệt.`} Chạy lại mô phỏng với dữ liệu mới để có phương án mới.</p></div>
      </div>)}
      {run.recommendations.length === 0 ? <p className="text-sm text-[#5f716c]">Kịch bản này không cần điều chỉnh: các Hub vẫn trong ngưỡng an toàn.</p> :
        <div className="grid gap-6 lg:grid-cols-3">{run.recommendations.map((item) => {
          const Icon = kindIcon[item.kind]
          const isStale = item.status === 'STALE'
          return <div key={item.recommendationId} className="flex flex-col">
            <Icon size={20} className="text-[#087f6a]" />
            <p className="mt-3 text-xs text-[#5f716c]">{item.recommendationId} · {item.status === 'PROPOSED' ? 'Đề xuất' : isStale ? `Bị từ chối lúc ${formatTime(item.decidedAt)}` : `Đã áp dụng lúc ${formatTime(item.decidedAt)}`} · snapshot {snapshotTime}</p>
            <p className="mt-2 font-semibold text-[#17332f]">{item.title}</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#5f716c]">{item.description}</p>
            <div className={`mt-3 rounded-lg p-3 text-xs ${isStale ? 'bg-[#fde8e6] text-[#b42318]' : 'bg-[#f4f7f6] text-[#17332f]'}`}>
              <p className="font-semibold uppercase">{isStale ? 'Điều kiện không còn đúng' : 'Kiểm tra lại khi áp dụng'}</p>
              <p className="mt-1">{isStale ? item.staleReason : item.precheck}</p>
            </div>
            <div className="mt-3">{isStale ? <Pill tone="danger">Đã cũ · không áp dụng</Pill> : item.status === 'APPLIED' ? <Pill tone="success">Đã áp dụng</Pill> : <Pill tone={proposedTag[item.kind].tone}>{proposedTag[item.kind].label}</Pill>}</div>
            <div className="mt-3"><Checkbox id={`rec-${item.recommendationId}`} checked={selected.includes(item.recommendationId)} onChange={() => item.status === 'PROPOSED' && toggle(item.recommendationId)} label={item.status === 'PROPOSED' ? 'Chọn khuyến nghị này' : 'Đã xử lý'} /></div>
          </div>
        })}</div>}
    </Card>

    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle title="Xét duyệt và xác nhận áp dụng" subtitle="Bước riêng · chưa có thay đổi vận hành cho đến khi xác nhận" />
          <Checkbox id="sim-confirm" checked={confirmed} onChange={setConfirmed} label="Tôi sẽ kiểm tra lại xe, chỗ đỗ, công suất hiện tại và trạng thái vận hành trước khi xác nhận áp dụng." />
          <p className="mt-2 text-xs leading-5 text-[#5f716c]">Chọn khuyến nghị rồi xác nhận. Khi xác nhận, hệ thống kiểm tra lại từng điều kiện với dữ liệu thật; điều kiện nào không còn đúng thì khuyến nghị đó bị từ chối và cần chạy lại mô phỏng.</p>
          <button type="button" onClick={() => navigate('/operator/simulation', { state: { preset: params } })} className="mt-4 rounded-lg border border-[#d7e2de] bg-white px-4 py-3 text-sm font-semibold text-[#17332f] hover:bg-[#f4f7f6]">Chạy lại với tham số khác</button>
        </div>
        <button type="button" disabled={!confirmed || selected.length === 0} onClick={confirm}
          className="inline-flex items-center gap-2 rounded-lg border border-[#d7e2de] bg-white px-5 py-3 text-sm font-semibold text-[#17332f] hover:bg-[#e6f4ef] disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight size={16} className="text-[#087f6a]" /> Xác nhận áp dụng khuyến nghị{selected.length ? ` (${selected.length})` : ''}</button>
      </div>
    </Card>

    {dispatch?.sourceHubId && dispatch.status === 'PROPOSED' && <DemoPanel title="Bảng mô phỏng · dữ liệu thật thay đổi sau snapshot">
      <DemoButton onClick={() => setWalkInNote(`${walkIn(dispatch.sourceHubId!, 7)} xe tại ${hubName(hubs, dispatch.sourceHubId)} vừa được thuê trực tiếp.`)}>7 xe tại {hubName(hubs, dispatch.sourceHubId)} vừa được thuê</DemoButton>
      {walkInNote && <span className="self-center text-xs text-[#5f716c]">{walkInNote}</span>}
    </DemoPanel>}
  </div>
}
