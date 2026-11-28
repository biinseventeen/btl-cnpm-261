// "Sự kiện vận hành gần đây": derived from timestamps already in the shared store, no extra log.
import type { MobilityState } from '../../store/useMobilityStore'
import type { PillTone } from '../../components/shared/ui'
import { hubName } from '../../lib/labels'

export interface ActivityItem { id: string; at: string; title: string; hub: string; tag: string; tone: PillTone }

type ActivitySource = Pick<MobilityState, 'hubs' | 'incidents' | 'dispatchOrders' | 'vehicleReservations' | 'chargingRequests' | 'parkingReservations'>

export const recentActivity = (state: ActivitySource, limit = 6): ActivityItem[] => {
  const name = (hubId?: string) => hubName(state.hubs, hubId)
  const items: ActivityItem[] = [
    ...state.incidents.map((incident) => ({
      id: `inc-${incident.incidentId}`, at: incident.createdAt, title: `${incident.assetId} · ${incident.title}`, hub: name(incident.hubId),
      tag: incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'Cần xử lý' : 'Cảnh báo',
      tone: (incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'danger' : 'warn') as PillTone,
    })),
    ...state.incidents.filter((incident) => incident.resolvedAt).map((incident) => ({
      id: `res-${incident.incidentId}`, at: incident.resolvedAt!, title: `${incident.assetId} · Đã xử lý sự cố`, hub: name(incident.hubId), tag: 'Đã ghi nhận', tone: 'success' as PillTone,
    })),
    ...state.dispatchOrders.filter((order) => order.createdAt).map((order) => ({
      id: `dsp-${order.orderId}`, at: order.createdAt!, title: `${order.orderId} · Điều phối ${order.vehicleIds.length} xe → ${name(order.destinationHubId)}`, hub: name(order.sourceHubId), tag: 'Thông tin', tone: 'info' as PillTone,
    })),
    ...state.vehicleReservations.filter((item) => item.returnedAt).map((item) => ({
      id: `trip-${item.reservationId}`, at: item.returnedAt!, title: `${item.vehicleId} · Hoàn tất hành trình`, hub: name(item.returnHubId), tag: 'Đã ghi nhận', tone: 'success' as PillTone,
    })),
    ...state.vehicleReservations.filter((item) => item.pickedUpAt).map((item) => ({
      id: `pick-${item.reservationId}`, at: item.pickedUpAt!, title: `${item.vehicleId} · Bắt đầu hành trình`, hub: name(item.hubId), tag: 'Thông tin', tone: 'info' as PillTone,
    })),
    ...state.chargingRequests.map((request) => ({
      id: `cr-${request.requestId}`, at: request.createdAt,
      title: `${request.vehicleId} · ${request.source === 'STUDENT' ? 'Yêu cầu sạc xe cá nhân' : `Yêu cầu sạc, pin ${request.battery}%`}`,
      hub: name(request.hubId), tag: request.battery <= 20 ? 'Cảnh báo' : 'Thông tin', tone: (request.battery <= 20 ? 'warn' : 'info') as PillTone,
    })),
    ...state.parkingReservations.filter((item) => item.checkedInAt).map((item) => ({
      id: `pk-${item.reservationId}`, at: item.checkedInAt!, title: `${item.reservationId} · Check-in bãi đỗ${item.slotId ? ` ô ${item.slotId}` : ''}`, hub: name(item.hubId), tag: 'Thông tin', tone: 'info' as PillTone,
    })),
  ]
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}
