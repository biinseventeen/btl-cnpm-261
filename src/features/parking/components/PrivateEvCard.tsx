import { useState } from 'react'
import { Bike, Check } from 'lucide-react'
import type { PrivateEV } from '../../../types'
import { isTelemetryFresh } from '../../../store/parkingSlice'
import { formatTime } from '../format'
import { Card, CardTitle } from '../ui'

export default function PrivateEvCard({ vehicles, selectedId, onSelect, now }: { vehicles: PrivateEV[]; selectedId: string; onSelect?: (evId: string) => void; now: number }) {
  const [choosing, setChoosing] = useState(false)
  const selected = vehicles.find((ev) => ev.evId === selectedId)
  if (!selected) return <Card><CardTitle title="Xe cá nhân đã liên kết" subtitle="Tài khoản chưa liên kết phương tiện nào." /></Card>
  const fresh = isTelemetryFresh(selected.lastTelemetryAt, now)
  return <Card>
    <CardTitle title="Xe cá nhân đã liên kết" />
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#e6f4ef] text-[#087f6a]"><Bike size={28} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-[#17332f]">{selected.evId} · Xe máy điện</p>
        <p className="mt-1 text-sm text-[#5f716c]">{selected.plateNumber} · {selected.model}</p>
        <p className="mt-1 text-sm text-[#5f716c]">{fresh ? `Pin ${selected.battery}% · cập nhật ${formatTime(selected.lastTelemetryAt)}` : 'Chưa nhận được dữ liệu pin từ xe'}</p>
        <span className="mt-2 inline-flex rounded-full bg-[#e6f4ef] px-2.5 py-1 text-xs font-semibold text-[#087f6a]">Đã liên kết tài khoản</span>
      </div>
      {onSelect && vehicles.length > 1 && <button type="button" onClick={() => setChoosing((value) => !value)}
        className="rounded-lg border border-[#d7e2de] px-4 py-2.5 text-sm font-semibold text-[#17332f] hover:bg-[#f4f7f6]">Quản lý xe</button>}
    </div>
    {choosing && onSelect && <ul className="mt-4 grid gap-2" aria-label="Chọn phương tiện">
      {vehicles.map((ev) => <li key={ev.evId}><button type="button" onClick={() => { onSelect(ev.evId); setChoosing(false) }}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${ev.evId === selectedId ? 'border-[#087f6a] bg-[#e6f4ef]' : 'border-[#d7e2de] hover:bg-[#f4f7f6]'}`}>
        <span><span className="font-semibold">{ev.evId}</span> · {ev.plateNumber}</span>{ev.evId === selectedId && <Check size={16} className="text-[#087f6a]" />}
      </button></li>)}
    </ul>}
    <p className="mt-4 text-sm text-[#8a9a96]" title="Bản demo chưa hỗ trợ đăng ký xe mới">+ Đăng ký hoặc liên kết phương tiện khác (chưa hỗ trợ trong bản demo)</p>
  </Card>
}
