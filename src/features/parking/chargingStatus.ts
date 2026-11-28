import type { ChargingRequest, ChargingRequestEvent } from '../../types'
import { formatTime } from './format'
import type { Tone } from './ui'

export interface RequestView {
  tone: Tone | 'default'
  tagTone: Tone
  title: string
  tag: string
  description: string
  changed: boolean
}

const lastScheduleEvent = (events: ChargingRequestEvent[]) =>
  [...events].reverse().find((event) => event.type === 'RESCHEDULED' || event.type === 'SCHEDULE_CHANGED' || event.type === 'SCHEDULED')

export const latestChange = (events: ChargingRequestEvent[]) => {
  const last = lastScheduleEvent(events)
  return last && last.type !== 'SCHEDULED' ? last : undefined
}

export const pointAndTime = (pointId?: string, start?: string) =>
  pointId ? `Cổng ${pointId}${start ? `, bắt đầu ${formatTime(start)}` : ''}` : 'Chưa được cấp'

export const describeRequest = (request: ChargingRequest, events: ChargingRequestEvent[]): RequestView => {
  const change = latestChange(events)
  switch (request.status) {
    case 'NEEDS_VERIFICATION':
      return { tone: 'warn', tagTone: 'warn', title: 'Cần xác minh mức pin', tag: 'Cần xác minh', changed: false, description: 'Hệ thống chưa có mức pin của xe nên chưa đưa yêu cầu vào hàng đợi.' }
    case 'WAITING':
      return change?.type === 'RESCHEDULED'
        ? { tone: 'warn', tagTone: 'warn', title: 'Lịch sạc đã thay đổi', tag: 'Đang chờ xếp lại', changed: true, description: `Lịch cũ (cổng ${change.previousChargingPointId ?? '—'}) đã bị hủy. Hệ thống sẽ xếp lại và báo cho bạn khi có cổng và giờ mới.` }
        : { tone: 'success', tagTone: 'success', title: 'Đã gửi yêu cầu sạc', tag: 'Đang chờ xếp lịch', changed: false, description: 'Hệ thống lập lịch sẽ xếp cổng và giờ sạc. Bạn nhận thông báo khi có lịch, khi lịch thay đổi, hoặc khi yêu cầu không xếp được trong khung giờ mong muốn.' }
    case 'SCHEDULED':
      return change?.type === 'SCHEDULE_CHANGED'
        ? { tone: 'warn', tagTone: 'warn', title: 'Lịch sạc đã thay đổi', tag: 'Đã xếp lịch mới', changed: true, description: `Lịch cũ (cổng ${change.previousChargingPointId ?? '—'}) được thay bằng lịch mới bên dưới.` }
        : { tone: 'success', tagTone: 'success', title: 'Đã xếp lịch sạc', tag: 'Đã xếp lịch', changed: false, description: 'Cổng đã được giữ cho xe của bạn. Đến đúng giờ và cắm sạc tại cổng được cấp.' }
    case 'CHARGING':
      return { tone: 'success', tagTone: 'success', title: 'Đang sạc', tag: 'Đang sạc', changed: false, description: 'Xe của bạn đang được sạc.' }
    case 'FULFILLED':
      return { tone: 'neutral', tagTone: 'neutral', title: 'Đã sạc xong', tag: 'Hoàn tất', changed: false, description: 'Phiên sạc đã kết thúc.' }
    case 'EXPIRED':
      return { tone: 'danger', tagTone: 'danger', title: 'Yêu cầu hết hạn', tag: 'Hết hạn', changed: false, description: 'Hệ thống không xếp được cổng trong khung giờ bạn chọn. Bạn có thể gửi yêu cầu mới với Hub hoặc khung giờ khác.' }
    case 'CANCELLED':
      return { tone: 'neutral', tagTone: 'neutral', title: 'Đã hủy yêu cầu sạc', tag: 'Đã hủy', changed: false, description: 'Yêu cầu đã được hủy, cổng (nếu có) đã được trả lại.' }
  }
}

export const describeEvent = (event: ChargingRequestEvent, request: ChargingRequest): { title: string; detail: string; tone: Tone } => {
  switch (event.type) {
    case 'SUBMITTED': return { title: 'Đã gửi yêu cầu', tone: 'success', detail: `Đang chờ xếp lịch. Mức pin ${request.battery}%, ${request.batteryVerified === false ? 'chưa xác minh' : 'đọc từ xe'}.` }
    case 'SCHEDULED': return { title: 'Đã xếp lịch', tone: 'success', detail: `${pointAndTime(event.chargingPointId, event.scheduledStart)}.` }
    case 'SCHEDULE_CHANGED': return { title: 'Lịch đã đổi', tone: 'warn', detail: event.previousChargingPointId === event.chargingPointId
      ? `Giờ bắt đầu tại cổng ${event.chargingPointId} đổi từ ${formatTime(event.previousScheduledStart)} sang ${formatTime(event.scheduledStart)}.`
      : `Từ cổng ${event.previousChargingPointId ?? '—'} sang cổng ${event.chargingPointId ?? '—'}${event.scheduledStart ? `, bắt đầu ${formatTime(event.scheduledStart)}` : ''}.` }
    case 'RESCHEDULED': return { title: 'Lịch bị hủy', tone: 'danger', detail: `Cổng ${event.previousChargingPointId ?? '—'} không còn dành cho bạn. Yêu cầu quay lại hàng đợi.` }
    case 'CHARGING': return { title: 'Bắt đầu sạc', tone: 'success', detail: `Tại cổng ${event.chargingPointId ?? '—'}.` }
    case 'FULFILLED': return { title: 'Đã sạc xong', tone: 'success', detail: 'Phiên sạc kết thúc.' }
    case 'EXPIRED': return { title: 'Hết hạn', tone: 'danger', detail: 'Không xếp được cổng trong khung giờ mong muốn, hoặc xe không cắm sạc trong thời gian giữ cổng.' }
    case 'CANCELLED': return { title: 'Đã hủy', tone: 'neutral', detail: 'Yêu cầu đã được hủy.' }
  }
}
