// Presentation helpers for the Vehicle Journey screens.
import type { ReserveVehicleResult, ReturnVehicleResult, PickUpResult } from '../../store/vehicleJourneySlice'

// Distance from the student's campus position and marker position on the illustrated map (percent)
export const hubGeo: Record<string, { distance: number; x: number; y: number }> = {
  H2: { distance: 350, x: 46, y: 30 },
  H1: { distance: 600, x: 28, y: 52 },
  H5: { distance: 900, x: 9, y: 66 },
  H3: { distance: 1100, x: 70, y: 14 },
  H4: { distance: 1300, x: 63, y: 64 },
}

export const formatDistance = (meters?: number) => meters === undefined ? '—' : meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`

export const reserveErrorText: Record<Exclude<ReserveVehicleResult, { ok: true }>['reason'], string> = {
  VEHICLE_NOT_FOUND: 'Không tìm thấy xe này.',
  ALREADY_RESERVED: 'Xe vừa được sinh viên khác giữ trước.',
  VEHICLE_UNAVAILABLE: 'Xe đang không ở trạng thái Sẵn sàng (bảo trì, mất kết nối hoặc đang được sử dụng).',
  LOW_BATTERY: 'Pin của xe chỉ còn từ 20% trở xuống nên không thể đặt trước.',
  ACTIVE_RESERVATION_EXISTS: 'Bạn đang có một phiếu đặt xe hoặc chuyến đi chưa kết thúc.',
}

export const pickUpErrorText: Record<Exclude<PickUpResult, { ok: true }>['reason'], string> = {
  NOT_FOUND: 'Không tìm thấy phiếu đặt xe.',
  NOT_OWNER: 'Phiếu này không thuộc tài khoản của bạn.',
  INVALID_STATE: 'Phiếu không còn ở trạng thái chờ nhận xe.',
  EXPIRED: 'Phiếu đã hết hạn giữ xe 15 phút.',
  QR_MISMATCH: 'Mã QR không khớp với xe bạn đã đặt.',
}

export const returnErrorText: Record<Exclude<ReturnVehicleResult, { ok: true }>['reason'], string> = {
  NOT_FOUND: 'Không tìm thấy chuyến đi.',
  NOT_OWNER: 'Chuyến đi không thuộc tài khoản của bạn.',
  INVALID_STATE: 'Chuyến đi đã kết thúc.',
  HUB_NOT_FOUND: 'Không tìm thấy Hub đích.',
  HUB_FULL: 'Hub này đã hết chỗ, hãy chọn Hub khác còn chỗ.',
}

export const formatElapsed = (milliseconds: number) => {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
