// Tổng quan mạng lưới Mobility Hub (Figma Operations_Network_Overview_Screen 26:2). Read-only.
import { Link } from 'react-router'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { HUB_ALERT_UTILIZATION, hubUtilization } from '../../../store/storeUtils'
import { isDispatchEligible } from '../../../store/chargingSlice'
import { SEVERITY_RANK } from '../../../store/operationSlice'
import type { Hub } from '../../../types'
import { BarRow, Card, CardTitle, KpiCard, PageHeader, Pill, tableHeadClass, type PillTone } from '../../../components/shared/ui'
import { formatTime } from '../../../lib/format'
import { hubName, severityView } from '../../../lib/labels'
import { useNow } from '../../../lib/useNow'
import { recentActivity } from '../activity'

const hubState = (utilization: number): { label: string; tone: PillTone } =>
  utilization >= 95 ? { label: 'Quá tải', tone: 'danger' } : utilization >= HUB_ALERT_UTILIZATION ? { label: 'Cần chú ý', tone: 'warn' } : { label: 'Ổn định', tone: 'success' }

export default function OverviewPage() {
  const now = useNow()
  const state = useMobilityStore()
  const { hubs, vehicles, chargingPoints, incidents } = state

  const ready = vehicles.filter((vehicle) => isDispatchEligible(vehicle, now))
  const count = (status: string) => vehicles.filter((vehicle) => vehicle.status === status).length
  const pointCount = (status: string) => chargingPoints.filter((point) => point.status === status).length
  const attention = hubs.filter((hub) => hubUtilization(hub) >= HUB_ALERT_UTILIZATION)
  const charging = vehicles.filter((vehicle) => chargingPoints.some((point) => point.status === 'CHARGING' && point.vehicleId === vehicle.vehicleId)).length
  const inUse = count('IN_USE')
  const other = vehicles.length - ready.length - inUse - charging
  const openIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED')
  const alerts = [
    ...attention.map((hub) => ({ key: hub.hubId, tone: (hubUtilization(hub) >= 95 ? 'danger' : 'warn') as PillTone, level: hubUtilization(hub) >= 95 ? 'Nghiêm trọng' : 'Cao', title: hub.name, text: `Mức sử dụng ${hubUtilization(hub)}%. ${hubUtilization(hub) >= 95 ? 'Kiểm tra Hub thay thế gần nhất.' : 'Cân nhắc điều phối thêm xe.'}` })),
    ...openIncidents.filter((incident) => SEVERITY_RANK[incident.severity] <= 1).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .map((incident) => ({ key: incident.incidentId, tone: severityView[incident.severity].tone, level: severityView[incident.severity].label, title: `${incident.assetId} · ${incident.title}`, text: `${hubName(hubs, incident.hubId)} · phát hiện lúc ${formatTime(incident.createdAt)}.` })),
  ].slice(0, 4)
  const freePoints = (hub: Hub) => chargingPoints.filter((point) => point.hubId === hub.hubId && point.status === 'AVAILABLE').length

  return <div className="space-y-6">
    <PageHeader now={now} clockSuffix="Làm mới mỗi 5s" eyebrow="Giám sát vận hành / Tổng quan" title="Tổng quan mạng lưới Mobility Hub"
      subtitle="Theo dõi trạng thái Hub, phương tiện, cổng sạc và các cảnh báo vận hành." />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Hub đang hoạt động" value={`${hubs.length} / ${hubs.length}`} hint="Toàn mạng lưới đang kết nối" />
      <KpiCard label="Xe khả dụng" value={`${ready.length} / ${vehicles.length}`} hint={`${((ready.length / Math.max(1, vehicles.length)) * 100).toFixed(1).replace('.', ',')}% tổng số phương tiện`} />
      <KpiCard label="Cổng sạc trống" value={`${pointCount('AVAILABLE')} / ${chargingPoints.length}`} hint={`${pointCount('CHARGING')} đang sạc · ${pointCount('ASSIGNED')} đã gán · ${pointCount('ERROR')} lỗi`} hintTone="info" />
      <KpiCard label="Hub cần chú ý" value={`${attention.length} Hub`} hint={`Vượt ngưỡng sử dụng ${HUB_ALERT_UTILIZATION}%`} hintTone={attention.length ? 'warn' : 'success'} />
    </div>

    {attention.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fff4df] px-5 py-4">
      <div><p className="text-sm font-semibold text-[#946013]">Cần chú ý: nguy cơ quá tải tại {attention.length} Hub</p>
        <p className="mt-1 text-sm text-[#17332f]">{attention.map((hub) => `${hub.name} đạt ${hubUtilization(hub)}% công suất`).join(' · ')}. Kiểm tra và cân nhắc điều phối.</p></div>
      <Link to="/operator/dispatch" className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-[#946013] hover:underline">{attention.length} cảnh báo · Điều phối</Link>
    </div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Trạng thái Hub" subtitle="Tổng hợp sức chứa, xe khả dụng và tài nguyên sạc" />
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
            <thead className={tableHeadClass}><tr><th className="rounded-l-lg px-3 py-3">Mobility Hub</th><th>Đỗ xe</th><th>Xe sẵn sàng</th><th>Cổng sạc trống</th><th className="rounded-r-lg">Trạng thái</th></tr></thead>
            <tbody>{hubs.map((hub) => {
              const utilization = hubUtilization(hub)
              const view = hubState(utilization)
              return <tr key={hub.hubId} className="border-b border-[#e4ece9] last:border-0">
                <td className="px-3 py-4 font-semibold">{hub.name}</td>
                <td className={`font-semibold ${utilization >= 95 ? 'text-[#b42318]' : utilization >= HUB_ALERT_UTILIZATION ? 'text-[#946013]' : 'text-[#17332f]'}`}>{utilization}%</td>
                <td>{ready.filter((vehicle) => vehicle.hubId === hub.hubId).length} xe</td>
                <td>{freePoints(hub)} cổng</td>
                <td><Pill tone={view.tone}>{view.label}</Pill></td>
              </tr>
            })}</tbody>
          </table></div>
          <p className="mt-4 text-sm text-[#5f716c]">Ngưỡng cảnh báo được kích hoạt khi mức sử dụng đạt từ {HUB_ALERT_UTILIZATION}% trở lên (tính cả chỗ đang giữ và xe đang tới).</p>
        </Card>

        <Card>
          <CardTitle title="Sự kiện vận hành gần đây" subtitle="Các cập nhật mới nhất từ dữ liệu IoT hoặc dữ liệu mô phỏng" />
          <ul>{recentActivity(state).map((item) => <li key={item.id} className="grid grid-cols-[56px_1fr_auto] items-start gap-4 border-b border-[#e4ece9] py-4 last:border-0">
            <span className="text-sm text-[#5f716c]">{formatTime(item.at)}</span>
            <div className="min-w-0"><p className="text-sm font-semibold text-[#17332f]">{item.title}</p><p className="mt-1 text-xs text-[#5f716c]">{item.hub}</p></div>
            <Pill tone={item.tone}>{item.tag}</Pill>
          </li>)}</ul>
        </Card>
      </div>

      <aside className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Tình trạng phương tiện" subtitle={`Tổng ${vehicles.length} · Khác ${other}: Đặt ${count('RESERVED')} · Chờ sạc ${count('PENDING_CHARGING') - charging} · Điều phối ${count('IN_TRANSIT')} · Lỗi ${count('UNAVAILABLE')} · Mất kết nối ${count('DISCONNECTED')}`} />
          <div className="space-y-4">
            <BarRow label="Sẵn sàng" value={ready.length} max={vehicles.length} color="#087f6a" />
            <BarRow label="Đang sử dụng" value={inUse} max={vehicles.length} color="#2b5f8e" />
            <BarRow label="Đang sạc" value={charging} max={vehicles.length} color="#946013" />
            <BarRow label="Trạng thái khác" value={other} max={vehicles.length} color="#b42318" />
          </div>
        </Card>
        <Card>
          <CardTitle title="Tình trạng cổng sạc" subtitle={`${chargingPoints.length} cổng · Công suất định mức theo Hub`} />
          <div className="space-y-4">
            <BarRow label="Trống" value={pointCount('AVAILABLE')} max={chargingPoints.length} color="#087f6a" />
            <BarRow label="Đang sạc" value={pointCount('CHARGING')} max={chargingPoints.length} color="#2b5f8e" />
            <BarRow label="Đã gán / lỗi" value={pointCount('ASSIGNED') + pointCount('ERROR')} max={chargingPoints.length} color="#b42318" />
          </div>
        </Card>
        <Card>
          <CardTitle title="Cảnh báo cần xử lý" subtitle="Ưu tiên theo mức nghiêm trọng và tác động đến dịch vụ" />
          {alerts.length === 0 ? <p className="text-sm text-[#5f716c]">Không có cảnh báo.</p> :
            <ul>{alerts.map((alert) => <li key={alert.key} className="border-b border-[#e4ece9] py-4 first:pt-0 last:border-0">
              <div className="flex flex-wrap items-center gap-3"><Pill tone={alert.tone}>{alert.level}</Pill><span className="text-sm font-semibold text-[#17332f]">{alert.title}</span></div>
              <p className="mt-2 text-sm text-[#5f716c]">{alert.text}</p>
            </li>)}</ul>}
          <Link to="/operator/incidents" className="mt-4 block rounded-xl border border-[#e4ece9] px-4 py-3 text-sm font-semibold text-[#087f6a] hover:bg-[#f4f7f6]">Mở danh sách sự cố ({openIncidents.length} đang mở)</Link>
        </Card>
      </aside>
    </div>
  </div>
}
