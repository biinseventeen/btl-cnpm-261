// Cards reused by the reservation, expiry and trip screens (Figma VJ-03, VJ-03e, VJ-03f).
import type { ReactNode } from 'react'
import { Bike, QrCode } from 'lucide-react'
import type { Hub, Vehicle } from '../../../types'
import { Card, CardTitle, DetailRow, StatusTag, type Tone } from '../../../components/shared/ui'
import { formatCountdown, formatDateTime, hubLabel } from '../../../lib/format'
import { vehicleTypeLabel } from '../../../lib/labels'
import { estimatedRangeKm, JOURNEY_RULES } from '../../../store/vehicleJourneySlice'

export function VehicleThumb({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  return <div className={`grid shrink-0 place-items-center rounded-xl bg-[#eaf0ee] text-[#087f6a] ${size === 'lg' ? 'h-24 w-24' : 'h-10 w-10'}`}>
    <Bike size={size === 'lg' ? 40 : 18} />
  </div>
}

export function SelectedVehicleCard({ title, subtitle, vehicle, hub, tag }: {
  title: string; subtitle: string; vehicle: Vehicle; hub?: Hub; tag: { tone: Tone; label: string }
}) {
  return <Card>
    <CardTitle title={title} subtitle={subtitle} />
    <div className="flex items-center gap-5">
      <VehicleThumb />
      <div>
        <p className="text-2xl font-semibold text-[#17332f]">{vehicle.vehicleId}</p>
        <p className="mt-1 text-sm text-[#5f716c]">{vehicleTypeLabel(vehicle)} · {hubLabel(hub)}</p>
        <div className="mt-2"><StatusTag tone={tag.tone}>{tag.label}</StatusTag></div>
      </div>
    </div>
    <div className="mt-5">
      <DetailRow label="Mã xe" value={vehicle.vehicleId} />
      <DetailRow label="Loại xe" value={vehicleTypeLabel(vehicle)} />
      <DetailRow label="Vị trí Hub hiện tại" value={hubLabel(hub)} />
      <DetailRow label="Mức pin · quãng đường ước tính" value={`${vehicle.battery}% · ~${estimatedRangeKm(vehicle)} km`} />
    </div>
  </Card>
}

const holdTone = {
  active: { box: 'bg-[#e6f4ef]', big: 'text-[#087f6a]' },
  warn: { box: 'bg-[#fff4df]', big: 'text-[#946013]' },
  none: { box: 'bg-[#f4f7f6]', big: 'text-[#8a9a96]' },
}

export function HoldTimeCard({ subtitle, remainingMs, startedAt, expiresAt, hub, tone, caption, message }: {
  subtitle: string; remainingMs?: number; startedAt?: string; expiresAt?: string; hub?: Hub
  tone: keyof typeof holdTone; caption: string; message: ReactNode
}) {
  const colors = holdTone[tone]
  return <Card>
    <CardTitle title="Thời gian giữ xe" subtitle={subtitle} />
    <div className={`flex flex-wrap items-center gap-5 rounded-xl p-5 ${colors.box}`}>
      <div className="text-center">
        <p className={`text-4xl font-semibold tabular-nums ${colors.big}`}>{remainingMs === undefined ? '--:--' : formatCountdown(remainingMs)}</p>
        <p className={`mt-1 text-xs ${colors.big}`}>{caption}</p>
      </div>
      <p className="min-w-0 flex-1 text-sm leading-6 text-[#17332f]">{message}</p>
    </div>
    {startedAt && expiresAt && <div className="mt-4">
      <DetailRow label="Bắt đầu giữ xe" value={formatDateTime(startedAt)} />
      <DetailRow label="Hạn nhận xe" value={formatDateTime(expiresAt)} />
      <DetailRow label="Thời gian giữ tối đa" value={`${JOURNEY_RULES.holdMinutes} phút`} />
      <DetailRow label="Điểm nhận xe" value={hubLabel(hub)} />
    </div>}
  </Card>
}

export function TicketCode({ code, caption }: { code: string; caption: string }) {
  return <div className="mt-4 flex items-center gap-4">
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-[#e4ece9] bg-white text-[#17332f]"><QrCode size={40} /></div>
    <div className="min-w-0"><p className="break-all text-xl font-semibold text-[#17332f]">{code}</p><p className="mt-1 text-sm text-[#5f716c]">{caption}</p></div>
  </div>
}
