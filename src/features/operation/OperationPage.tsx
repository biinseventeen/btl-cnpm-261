import { useMobilityStore } from '../../store/useMobilityStore'
import StatCard from '../../components/shared/StatCard'
import StatusPill from '../../components/shared/StatusPill'

export default function OperationPage() {
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const incidents = useMobilityStore((s) => s.incidents)
  const preview = useMobilityStore((s) => s.simulationPreview)
  const applyRecommendation = useMobilityStore((s) => s.applySimulationRecommendation)
  const available = vehicles.filter((v) => v.status === 'AVAILABLE').length
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED').length
  const utilization = (hub: typeof hubs[number]) => Math.round(((hub.occupiedSlots + hub.heldSlots + hub.incomingReserved) / hub.totalSlots) * 100)

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-teal-700">Operator workspace</p><h2 className="mt-1 text-2xl font-bold">Network overview</h2><p className="mt-1 text-sm text-slate-500">Tổng quan hoạt động các Mobility Hub · Mock data</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Mobility Hubs" value={hubs.length} />
      <StatCard label="Total vehicles" value={vehicles.length} />
      <StatCard label="Available vehicles" value={available} />
      <StatCard label="Open incidents" value={openIncidents} />
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Hub utilization</h3><span className="text-xs text-slate-400">Cảnh báo từ 85%</span></div>
      <div className="space-y-4">
        {hubs.map((hub) => <div key={hub.hubId}>
          <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{hub.hubId} · {hub.name}</span><span className="tabular-nums text-slate-500">{utilization(hub)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${utilization(hub) >= 85 ? 'bg-rose-500' : 'bg-teal-600'}`} style={{ width: `${Math.min(utilization(hub), 100)}%` }} /></div>
          <p className="mt-1 text-xs text-slate-400">{hub.occupiedSlots} occupied · {hub.heldSlots} held · {hub.incomingReserved} incoming · {hub.totalSlots} capacity</p>
        </div>)}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">What-if simulation preview</h3><p className="text-xs text-slate-500">Snapshot không tự thay đổi dữ liệu vận hành.</p></div><StatusPill status={preview.status} /></div>
      <p className="text-sm text-slate-600">Đề xuất chuyển {preview.vehicleIds.length} xe từ {preview.sourceHubId} sang {preview.destinationHubId}.</p>
      <button onClick={() => alert(`Kết quả: ${applyRecommendation()}`)} disabled={preview.status !== 'READY'} className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">Apply recommendation</button>
    </section>
  </div>
}