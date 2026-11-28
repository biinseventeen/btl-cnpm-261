import type { ReactNode } from 'react'
import type { ParkingSlot } from '../../../types'

type TileKind = 'mine' | 'free' | 'busy' | 'warn'

const tileClass: Record<TileKind, string> = {
  mine: 'border-[#087f6a] bg-[#087f6a] text-white',
  free: 'border-[#d7e2de] bg-white text-[#087f6a]',
  busy: 'border-transparent bg-[#eaf0ee] text-[#6b7c78]',
  warn: 'border-transparent bg-[#fff4df] text-[#946013]',
}

export const describeSlot = (slot: ParkingSlot, mySlotId?: string): { kind: TileKind; label: string } => {
  if (slot.slotId === mySlotId) return { kind: 'mine', label: 'Ô của bạn' }
  if (slot.status === 'UNAVAILABLE') return { kind: 'warn', label: 'Bảo trì' }
  if (slot.status === 'OCCUPIED') return { kind: 'busy', label: 'Có xe' }
  if (slot.status === 'ASSIGNED') return { kind: 'busy', label: 'Đã cấp' }
  if (slot.sensorStatus === 'FAULT') return { kind: 'warn', label: 'Cảm biến lỗi' }
  if (slot.sensorStatus === 'STALE') return { kind: 'warn', label: 'Mất tín hiệu' }
  return { kind: 'free', label: 'Trống' }
}

const legend: { kind: TileKind; label: string }[] = [
  { kind: 'mine', label: 'Ô của bạn' },
  { kind: 'free', label: 'Trống' },
  { kind: 'busy', label: 'Có xe / đã cấp' },
  { kind: 'warn', label: 'Bảo trì / lỗi cảm biến' },
]

export default function SlotGrid({ slots, mySlotId, renderActions }: { slots: ParkingSlot[]; mySlotId?: string; renderActions?: (slot: ParkingSlot) => ReactNode }) {
  const sorted = [...slots].sort((a, b) => a.slotId.localeCompare(b.slotId))
  return <div>
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {sorted.map((slot) => {
        const { kind, label } = describeSlot(slot, mySlotId)
        return <li key={slot.slotId} id={`slot-${slot.slotId}`} data-testid={`slot-${slot.slotId}`}
          className={`rounded-lg border px-2.5 py-2 ${tileClass[kind]} ${kind === 'mine' ? 'ring-2 ring-[#087f6a]/30' : ''}`}>
          <p className="text-sm font-semibold">{slot.slotId}</p>
          <p className="mt-0.5 text-xs">{label}</p>
          {renderActions?.(slot)}
        </li>
      })}
    </ul>
    <ul className="mt-3 flex flex-wrap gap-4 text-xs text-[#5f716c]">
      {legend.map((item) => <li key={item.kind} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm border ${tileClass[item.kind]}`} />{item.label}</li>)}
    </ul>
  </div>
}
