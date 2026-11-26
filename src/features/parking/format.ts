import type { Hub, ParkingFailureReason } from '../../types'
import type { CheckInResult, ReserveParkingResult, SubmitChargingResult } from '../../store/parkingSlice'

const pad = (value: number) => String(value).padStart(2, '0')

export const formatTime = (iso?: string) => {
  if (!iso) return '--:--'
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export const formatDate = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}
export const formatShortDate = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
}
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`
export const formatClock = (now: number) => {
  const date = new Date(now)
  return `${formatDate(date.toISOString())} · ${formatTime(date.toISOString())}:${pad(date.getSeconds())}`
}
export const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`
}

// Values for <input type="date"> and <input type="time">, in local time
export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
export const combineDateTime = (date: string, time: string) => {
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? '' : value.toISOString()
}
export const roundUpMinutes = (timestamp: number, step: number) => {
  const date = new Date(timestamp)
  date.setSeconds(0, 0)
  date.setMinutes(Math.ceil(date.getMinutes() / step) * step)
  return date
}

export const hubLabel = (hub?: Hub) => hub ? `${hub.name} · ${hub.hubId}` : '—'

// "A-12" -> "Khu A · dãy 2" (8 slots per row, as drawn in Figma)
export const slotLocation = (slotId: string) => {
  const [zone, number] = slotId.split('-')
  return `Khu ${zone} · dãy ${Math.ceil(Number(number) / 8)}`
}

export const reserveErrorMessage: Record<Exclude<ReserveParkingResult, { ok: true }>['reason'], string> = {
  HUB_NOT_FOUND: 'Không tìm thấy Hub này.',
  HUB_FULL: 'Hub đã hết chỗ trong sức chứa. Chọn một Hub khác còn chỗ.',
  DUPLICATE_RESERVATION: 'Bạn đang có một đơn đặt chỗ chưa kết thúc tại Hub này.',
  INVALID_ARRIVAL_TIME: 'Giờ đến phải nằm trong 2 giờ tới.',
  EV_NOT_OWNED: 'Phương tiện này không thuộc tài khoản của bạn.',
}

export const failureMessage: Record<ParkingFailureReason, string> = {
  HUB_FULL: 'Hub đã hết chỗ',
  NO_PHYSICAL_SLOT: 'Không còn ô trống',
  SENSOR_UNAVAILABLE: 'Không còn ô trống có cảm biến hoạt động',
}

export const checkInErrorMessage: Record<Exclude<CheckInResult, { ok: true }>['reason'], string> = {
  ...failureMessage,
  NOT_FOUND: 'Không tìm thấy đơn đặt chỗ.',
  NOT_OWNER: 'Đơn này không thuộc tài khoản của bạn.',
  INVALID_STATE: 'Đơn không còn ở trạng thái chờ check-in.',
  EXPIRED: 'Đơn đã quá hạn check-in và bị hủy.',
}

export const chargingErrorMessage: Record<Exclude<SubmitChargingResult, { ok: true }>['reason'], string> = {
  EV_NOT_FOUND: 'Không tìm thấy phương tiện.',
  NOT_OWNER: 'Phương tiện này không thuộc tài khoản của bạn.',
  HUB_NOT_FOUND: 'Không tìm thấy Hub sạc.',
  INVALID_WINDOW: 'Khung giờ không hợp lệ: giờ kết thúc phải sau giờ bắt đầu và chưa trôi qua.',
  DUPLICATE_REQUEST: 'Xe này đang có một yêu cầu sạc chưa kết thúc.',
  BATTERY_REQUIRED: 'Chưa có dữ liệu pin từ xe, hãy nhập mức pin hiện tại.',
  INVALID_BATTERY: 'Mức pin phải là số nguyên từ 0 đến 100.',
  BATTERY_NOT_CONFIRMED: 'Hãy xác nhận mức pin nhập tay đúng với hiển thị trên xe.',
}
