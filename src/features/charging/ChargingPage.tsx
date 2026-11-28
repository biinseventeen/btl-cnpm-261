import { useMobilityStore } from '../../store/useMobilityStore'
import StatusPill from '../../components/shared/StatusPill'

export default function ChargingPage() {
  const requests = useMobilityStore((s) => s.chargingRequests)
  const points = useMobilityStore((s) => s.chargingPoints)
  const schedule = useMobilityStore((s) => s.scheduleChargingRequest)
  return <div className="space-y-5">
    <div><p className="text-sm font-medium text-teal-700">Resource management</p><h2 className="mt-1 text-2xl font-bold">Charging queue & points</h2><p className="mt-1 text-sm text-slate-500">Kiệt phụ trách thay nội dung khung này bằng UI từ Figma.</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 font-semibold">Charging requests</h3><div className="space-y-3">
      {requests.map((request) => <div key={request.requestId} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><div><p className="text-sm font-semibold">{request.requestId} · {request.vehicleId}</p><p className="text-xs text-slate-500">Hub {request.hubId} · Battery {request.battery}%</p></div><div className="flex items-center gap-2"><StatusPill status={request.status} />{request.status === 'WAITING' && points.some((p) => p.hubId === request.hubId && p.status === 'AVAILABLE') && <button onClick={() => schedule(request.requestId, points.find((p) => p.hubId === request.hubId && p.status === 'AVAILABLE')!.chargingPointId)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Assign point</button>}</div></div>)}
      {requests.length === 0 && <p className="text-sm text-slate-400">No requests yet.</p>}
    </div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 font-semibold">Charging points</h3><div className="grid gap-3 sm:grid-cols-2">{points.map((p) => <div key={p.chargingPointId} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-2"><span className="text-sm font-medium">{p.chargingPointId}</span><StatusPill status={p.status} /></div><p className="mt-1 text-xs text-slate-500">Hub {p.hubId} · {p.powerKw} kW</p></div>)}</div></section>
  </div>
}