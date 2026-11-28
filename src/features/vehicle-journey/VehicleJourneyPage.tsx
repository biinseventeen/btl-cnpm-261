import { useMobilityStore } from '../../store/useMobilityStore'
import StatusPill from '../../components/shared/StatusPill'

export default function VehicleJourneyPage() {
  const vehicles = useMobilityStore((s) => s.vehicles)
  const reserveVehicle = useMobilityStore((s) => s.reserveVehicle)
  const returnVehicle = useMobilityStore((s) => s.returnVehicle)
  return <div className="space-y-5">
    <div><p className="text-sm font-medium text-teal-700">Student workspace</p><h2 className="mt-1 text-2xl font-bold">Find & reserve a vehicle</h2><p className="mt-1 text-sm text-slate-500">Khải phụ trách thay nội dung khung này bằng UI từ Figma.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      {vehicles.map((vehicle) => <article key={vehicle.vehicleId} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="font-semibold">{vehicle.vehicleId}</h3><StatusPill status={vehicle.status} /></div>
        <p className="mt-2 text-sm text-slate-500">Hub {vehicle.hubId} · Battery {vehicle.battery}%</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => reserveVehicle(vehicle.vehicleId)} disabled={vehicle.status !== 'AVAILABLE'} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Reserve</button>
          <button onClick={() => returnVehicle(vehicle.vehicleId, 'H2', 15)} disabled={!['IN_USE', 'RESERVED'].includes(vehicle.status)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Demo return · 15%</button>
        </div>
      </article>)}
    </div>
  </div>
}