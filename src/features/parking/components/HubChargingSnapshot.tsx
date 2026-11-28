import { useMobilityStore } from '../../../store/useMobilityStore'
import { formatTime } from '../format'
import { Card, CardTitle, DetailRow } from '../ui'

// Read-only view of Kiệt's charging points, only to help the student choose a hub (Sub3 #8).
export default function HubChargingSnapshot({ hubId, now }: { hubId: string; now: number }) {
  const hub = useMobilityStore((s) => s.hubs.find((item) => item.hubId === hubId))
  const allPoints = useMobilityStore((s) => s.chargingPoints)
  const points = allPoints.filter((point) => point.hubId === hubId)
  const charging = points.filter((point) => point.status === 'CHARGING').length
  const free = points.filter((point) => point.status === 'AVAILABLE').length
  const power = points.reduce((sum, point) => sum + point.powerKw, 0)
  return <Card>
    <CardTitle title={`Tài nguyên tại ${hub?.name ?? hubId}`} subtitle={`Ảnh chụp ${formatTime(new Date(now).toISOString())} · chỉ để tham khảo khi chọn Hub`} />
    <DetailRow label="Cổng đang sạc" value={`${charging}/${points.length} cổng`} />
    <DetailRow label="Cổng trống" value={`${free} cổng`} />
    <DetailRow label="Giới hạn công suất" value={`${Math.round(power * 10) / 10} kW`} />
    <p className="mt-3 text-xs leading-5 text-[#5f716c]">Số cổng trống không phải cổng được cấp cho bạn và có thể đã thay đổi khi tới giờ sạc.</p>
  </Card>
}
