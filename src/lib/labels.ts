// Vietnamese labels and tones for shared statuses, used by student and operator screens alike.
import type { ChargingPointStatus, Hub, IncidentSeverity, OperationalIncident, Vehicle, VehicleStatus } from '../types'
import type { PillTone } from '../components/shared/ui'

export const vehicleTypeLabel = (vehicle?: Pick<Vehicle, 'vehicleType'>) => vehicle?.vehicleType === 'E_SCOOTER' ? 'Xe máy điện' : 'Xe đạp điện'

export const vehicleStatusView: Record<VehicleStatus, { label: string; tone: PillTone }> = {
  AVAILABLE: { label: 'Sẵn sàng', tone: 'success' },
  RESERVED: { label: 'Đã đặt', tone: 'info' },
  IN_USE: { label: 'Đang sử dụng', tone: 'blue' },
  PENDING_CHARGING: { label: 'Chờ sạc', tone: 'warn' },
  IN_TRANSIT: { label: 'Đang điều phối', tone: 'purple' },
  UNAVAILABLE: { label: 'Bảo trì / lỗi', tone: 'danger' },
  DISCONNECTED: { label: 'Mất kết nối', tone: 'neutral' },
}

export const pointStatusView: Record<ChargingPointStatus, { label: string; tone: PillTone }> = {
  AVAILABLE: { label: 'Trống', tone: 'success' },
  ASSIGNED: { label: 'Đã gán', tone: 'info' },
  CHARGING: { label: 'Đang sạc', tone: 'success' },
  ERROR: { label: 'Lỗi', tone: 'danger' },
}

export const severityView: Record<IncidentSeverity, { label: string; tone: PillTone }> = {
  CRITICAL: { label: 'Nghiêm trọng', tone: 'danger' },
  HIGH: { label: 'Cao', tone: 'warn' },
  MEDIUM: { label: 'Trung bình', tone: 'info' },
  LOW: { label: 'Thấp', tone: 'neutral' },
}

export type IncidentStage = 'NEW' | 'WAITING_TECH' | 'IN_PROGRESS' | 'RESOLVED'
export const incidentStage = (incident: OperationalIncident): IncidentStage =>
  incident.status === 'RESOLVED' ? 'RESOLVED'
    : incident.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
      : incident.technicianNotifiedAt ? 'WAITING_TECH' : 'NEW'

export const incidentStageView: Record<IncidentStage, { label: string; tone: PillTone }> = {
  NEW: { label: 'Mới', tone: 'info' },
  WAITING_TECH: { label: 'Chờ kỹ thuật', tone: 'danger' },
  IN_PROGRESS: { label: 'Đang xử lý', tone: 'warn' },
  RESOLVED: { label: 'Đã xử lý', tone: 'success' },
}

export type AssetKind = 'VEHICLE' | 'CHARGING_POINT' | 'PARKING_SLOT' | 'HUB'
export const assetKindLabel: Record<AssetKind, string> = {
  VEHICLE: 'Phương tiện', CHARGING_POINT: 'Cổng sạc', PARKING_SLOT: 'Ô đỗ', HUB: 'Hub',
}

export const hubName = (hubs: Hub[], hubId?: string) => hubs.find((hub) => hub.hubId === hubId)?.name ?? hubId ?? '—'
