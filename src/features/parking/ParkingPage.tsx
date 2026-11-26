import { useMobilityStore } from '../../store/useMobilityStore'
import StatusPill from '../../components/shared/StatusPill'

export default function ParkingPage() {
  const slots = useMobilityStore((s) => s.parkingSlots)
  const reservations = useMobilityStore((s) => s.parkingReservations)
  const createReservation = useMobilityStore((s) => s.createParkingReservation)
  return <div className="space-y-5">
    <div><p className="text-sm font-medium text-teal-700">Student parking</p><h2 className="mt-1 text-2xl font-bold">Parking & Private EV</h2><p className="mt-1 text-sm text-slate-500">Lợi phụ trách thay nội dung khung này bằng UI từ Figma.</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Parking reservations</h3><button onClick={() => createReservation('S-01', 'H1')} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Create demo reservation</button></div><div className="mt-4 space-y-2">{reservations.map((r) => <div key={r.reservationId} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-semibold">{r.reservationId} · {r.studentId}</p><p className="text-xs text-slate-500">Hub {r.hubId}</p></div><StatusPill status={r.status} /></div>)}</div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="mb-3 font-semibold">Physical parking slots</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{slots.map((slot) => <div key={slot.slotId} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold">{slot.slotId}</p><div className="mt-2"><StatusPill status={slot.status} /></div><p className="mt-1 text-xs text-slate-500">Hub {slot.hubId}</p></div>)}</div></div>
  </div>
}