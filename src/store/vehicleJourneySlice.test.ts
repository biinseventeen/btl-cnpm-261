import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobilityStore } from './useMobilityStore'
import { JOURNEY_RULES } from './vehicleJourneySlice'
import { hubFreeSlots } from './storeUtils'

const S = () => useMobilityStore.getState()
const vehicle = (id: string) => S().vehicles.find((item) => item.vehicleId === id)!
const hub = (id: string) => S().hubs.find((item) => item.hubId === id)!
const booking = (id: string) => S().vehicleReservations.find((item) => item.reservationId === id)!
const MINUTE = 60 * 1000
const advance = (minutes: number) => vi.setSystemTime(Date.now() + minutes * MINUTE)

const reserve = (vehicleId = 'SM-001', studentId = 'S-02') => {
  const result = S().reserveSharedVehicle(studentId, vehicleId)
  if (!result.ok) throw new Error(`reserve failed: ${result.reason}`)
  return result.reservationId
}
const startTrip = (vehicleId = 'SM-001') => {
  const id = reserve(vehicleId)
  expect(S().pickUpVehicle('S-02', id, vehicleId)).toEqual({ ok: true })
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-26T08:00:00+07:00'))
  S().resetDemo()
})
afterEach(() => vi.useRealTimers())

describe('đặt trước xe (VJ-03)', () => {
  it('giữ xe 15 phút và đánh mã VJ-YYMMDD-001', () => {
    const id = reserve()
    expect(id).toBe('VJ-261126-001')
    expect(vehicle('SM-001').status).toBe('RESERVED')
    expect(new Date(booking(id).expiresAt).getTime() - Date.now()).toBe(JOURNEY_RULES.holdMinutes * MINUTE)
  })

  it('từ chối xe người khác đã giữ (VJ-03e), pin thấp, mất kết nối', () => {
    expect(S().reserveSharedVehicle('S-02', 'SM-024')).toEqual({ ok: false, reason: 'ALREADY_RESERVED' })
    expect(S().reserveSharedVehicle('S-02', 'SM-011')).toEqual({ ok: false, reason: 'VEHICLE_UNAVAILABLE' })
    expect(S().reserveSharedVehicle('S-02', 'SM-050')).toEqual({ ok: false, reason: 'VEHICLE_UNAVAILABLE' })
    S().setVehicleTelemetry('SM-002', { battery: 20 })
    expect(S().reserveSharedVehicle('S-02', 'SM-002')).toEqual({ ok: false, reason: 'LOW_BATTERY' })
  })

  it('mỗi sinh viên chỉ có một phiếu mở', () => {
    reserve()
    expect(S().reserveSharedVehicle('S-02', 'SM-002')).toEqual({ ok: false, reason: 'ACTIVE_RESERVATION_EXISTS' })
  })

  it('hết 15 phút thì phiếu EXPIRED và xe về AVAILABLE (VJ-03f)', () => {
    const id = reserve()
    advance(15)
    S().sweepVehicleReservations()
    expect(booking(id).status).toBe('RESERVED')
    advance(0.1)
    S().sweepVehicleReservations()
    expect(booking(id).status).toBe('EXPIRED')
    expect(vehicle('SM-001').status).toBe('AVAILABLE')
    expect(S().pickUpVehicle('S-02', id, 'SM-001')).toEqual({ ok: false, reason: 'EXPIRED' })
  })

  it('hủy phiếu trả xe về AVAILABLE, người khác không hủy được', () => {
    const id = reserve()
    expect(S().cancelVehicleReservation('S-03', id)).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().cancelVehicleReservation('S-02', id)).toEqual({ ok: true })
    expect(vehicle('SM-001').status).toBe('AVAILABLE')
  })
})

describe('nhận xe bằng QR (VJ-04)', () => {
  it('QR sai mã bị từ chối, QR đúng chuyển IN_USE và giảm chỗ đang đỗ', () => {
    const before = hub('H2').occupiedSlots
    const id = reserve()
    expect(S().pickUpVehicle('S-02', id, 'SM-002')).toEqual({ ok: false, reason: 'QR_MISMATCH' })
    expect(S().pickUpVehicle('S-02', id, ' sm-001 ')).toEqual({ ok: true })
    expect(vehicle('SM-001').status).toBe('IN_USE')
    expect(booking(id).startBattery).toBe(85)
    expect(hub('H2').occupiedSlots).toBe(before - 1)
  })

  it('tạm khóa chỉ dùng được khi đang đi', () => {
    const id = reserve()
    expect(S().toggleTripLock('S-02', id)).toEqual({ ok: false, reason: 'INVALID_STATE' })
    S().pickUpVehicle('S-02', id, 'SM-001')
    S().toggleTripLock('S-02', id)
    expect(booking(id).locked).toBe(true)
  })
})

describe('trả xe (VJ-05)', () => {
  it('Hub đầy thì từ chối và giữ nguyên hành trình', () => {
    const id = startTrip()
    expect(hubFreeSlots(hub('H3'))).toBe(0)
    expect(S().returnSharedVehicle('S-02', id, 'H3')).toEqual({ ok: false, reason: 'HUB_FULL' })
    expect(booking(id).status).toBe('IN_USE')
  })

  it('pin trên 20% thì xe AVAILABLE tại Hub mới', () => {
    const id = startTrip()
    const before = hub('H5').occupiedSlots
    const result = S().returnSharedVehicle('S-02', id, 'H5')
    expect(result).toMatchObject({ ok: true, outcome: 'AVAILABLE' })
    expect(vehicle('SM-001')).toMatchObject({ hubId: 'H5', status: 'AVAILABLE' })
    expect(hub('H5').occupiedSlots).toBe(before + 1)
  })

  it('pin ≤20% thì PENDING_CHARGING và tạo đúng một yêu cầu sạc', () => {
    const id = startTrip()
    S().setVehicleTelemetry('SM-001', { battery: 15 })
    const result = S().returnSharedVehicle('S-02', id, 'H1')
    expect(result).toMatchObject({ ok: true, outcome: 'PENDING_CHARGING' })
    const requests = S().chargingRequests.filter((item) => item.vehicleId === 'SM-001')
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ source: 'SYSTEM', status: 'WAITING', hubId: 'H1', battery: 15 })
  })

  it('xe báo lỗi thì UNAVAILABLE và tạo sự cố; mất heartbeat được ưu tiên hơn lỗi', () => {
    const first = startTrip()
    S().setVehicleTelemetry('SM-001', { faultCode: 'ERR-MOTOR-02' })
    const fault = S().returnSharedVehicle('S-02', first, 'H1')
    expect(fault).toMatchObject({ ok: true, outcome: 'UNAVAILABLE' })
    expect(S().incidents.find((item) => item.incidentId === (fault.ok ? fault.incidentId : ''))?.faultCode).toBe('ERR-MOTOR-02')

    const second = startTrip('SM-002')
    S().setVehicleTelemetry('SM-002', { faultCode: 'ERR-X', heartbeatLost: true })
    expect(S().returnSharedVehicle('S-02', second, 'H1')).toMatchObject({ ok: true, outcome: 'DISCONNECTED' })
  })
})

describe('telemetry demo', () => {
  it('pin giảm 0,4%/phút khi đang đi, heartbeat được làm mới', () => {
    startTrip()
    S().tickVehicleTelemetry()
    advance(10) // laptop asleep: no tick for 10 minutes
    S().tickVehicleTelemetry()
    expect(vehicle('SM-001').battery).toBe(81)
    expect(Date.now() - new Date(vehicle('SM-001').lastHeartbeat).getTime()).toBe(0)
  })

  it('xe đã mất kết nối hoặc bị cắt heartbeat không tự có heartbeat lại', () => {
    S().tickVehicleTelemetry()
    const before = vehicle('SM-050').lastHeartbeat
    S().setVehicleTelemetry('SM-002', { heartbeatLost: true })
    const lost = vehicle('SM-002').lastHeartbeat
    advance(1 / 12)
    S().tickVehicleTelemetry()
    expect(vehicle('SM-050').lastHeartbeat).toBe(before)
    expect(vehicle('SM-002').lastHeartbeat).toBe(lost)
  })
})
