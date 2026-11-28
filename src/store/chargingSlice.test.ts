import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobilityStore } from './useMobilityStore'
import { DISPATCH_RULES, isDispatchEligible, orderChargingQueue } from './chargingSlice'
import type { ChargingRequest } from '../types'

const S = () => useMobilityStore.getState()
const request = (id: string) => S().chargingRequests.find((item) => item.requestId === id)!
const point = (id: string) => S().chargingPoints.find((item) => item.chargingPointId === id)!
const hub = (id: string) => S().hubs.find((item) => item.hubId === id)!
const vehicle = (id: string) => S().vehicles.find((item) => item.vehicleId === id)!
const queueIds = () => orderChargingQueue(S().chargingRequests, S().chargingQueueOrder).map((item) => item.requestId)
const eligibleAt = (hubId: string) => S().vehicles.filter((item) => item.hubId === hubId && isDispatchEligible(item)).map((item) => item.vehicleId)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-26T08:00:00+07:00'))
  S().resetDemo()
})
afterEach(() => vi.useRealTimers())

describe('hàng đợi sạc', () => {
  it('pin thấp xếp trước, pin nhập tay chưa xác minh không được ưu tiên cao', () => {
    const base = { source: 'STUDENT', hubId: 'H1', status: 'WAITING', createdAt: new Date().toISOString() } as const
    const requests: ChargingRequest[] = [
      { ...base, requestId: 'A', vehicleId: 'A', battery: 10, batteryVerified: false },
      { ...base, requestId: 'B', vehicleId: 'B', battery: 15, batteryVerified: true },
      { ...base, requestId: 'C', vehicleId: 'C', battery: 15, batteryVerified: true, createdAt: new Date(Date.now() - 60000).toISOString() },
    ]
    expect(orderChargingQueue(requests, []).map((item) => item.requestId)).toEqual(['C', 'B', 'A'])
  })

  it('điều chỉnh thủ công bắt buộc có lý do và được ghi audit', () => {
    const [first, second] = queueIds()
    expect(S().moveChargingRequest(second, 1, '  ')).toEqual({ ok: false, reason: 'REASON_REQUIRED' })
    expect(S().moveChargingRequest(second, 2, 'lý do đủ dài')).toEqual({ ok: false, reason: 'SAME_POSITION' })
    expect(S().moveChargingRequest(second, 1, 'Xe cần chạy ca sáng')).toEqual({ ok: true })
    expect(queueIds().slice(0, 2)).toEqual([second, first])
    expect(S().chargingQueueAdjustments.at(-1)).toMatchObject({ requestId: second, fromPosition: 2, toPosition: 1, actor: 'Operator Minh' })
  })

  it('gán cổng: phải cùng Hub, cổng phải trống; ASSIGNED → CHARGING → FULFILLED', () => {
    expect(S().scheduleChargingRequest('CR-001', 'CP-H1-01')).toEqual({ ok: false, reason: 'WRONG_HUB' })
    expect(S().scheduleChargingRequest('CR-001', 'CP-H2-02')).toEqual({ ok: false, reason: 'POINT_NOT_AVAILABLE' })
    expect(S().scheduleChargingRequest('CR-001', 'CP-H2-01')).toEqual({ ok: true })
    expect(point('CP-H2-01').status).toBe('ASSIGNED')
    expect(S().completeCharging('CR-001')).toEqual({ ok: false, reason: 'INVALID_STATE' })
    S().startCharging('CR-001')
    expect(point('CP-H2-01').status).toBe('CHARGING')
    S().completeCharging('CR-001')
    expect(request('CR-001').status).toBe('FULFILLED')
    expect(point('CP-H2-01').status).toBe('AVAILABLE')
    expect(vehicle('SM-019')).toMatchObject({ battery: 100, status: 'AVAILABLE' })
  })

  it('cổng báo lỗi đưa yêu cầu đang sạc về hàng đợi và tạo sự cố', () => {
    const incidentId = S().reportChargingPointFault('CP-H1-02')
    expect(incidentId).toMatch(/^INC-/)
    expect(point('CP-H1-02').status).toBe('ERROR')
    expect(request('CR-002')).toMatchObject({ status: 'WAITING', chargingPointId: undefined })
  })

  it('xếp lịch tự động chỉ dùng cổng trống cùng Hub', () => {
    const scheduled = S().autoScheduleCharging()
    expect(scheduled).toBeGreaterThan(0)
    for (const item of S().chargingRequests.filter((entry) => entry.status === 'SCHEDULED')) {
      expect(point(item.chargingPointId!).hubId).toBe(item.hubId)
    }
  })
})

describe('điều phối xe', () => {
  it('giữ tối thiểu 3 xe tại Hub nguồn và không vượt chỗ Hub đích', () => {
    const ids = eligibleAt('H2')
    expect(S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H2', vehicleIds: ids.slice(0, 1) })).toEqual({ ok: false, reason: 'SAME_HUB' })
    expect(S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H5', vehicleIds: ids.slice(0, ids.length - DISPATCH_RULES.minSourceStock + 1) })).toEqual({ ok: false, reason: 'BELOW_MIN_STOCK' })
    expect(S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H3', vehicleIds: ids.slice(0, 1) })).toEqual({ ok: false, reason: 'DESTINATION_FULL' })
    expect(S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H5', vehicleIds: ['SM-011'] })).toEqual({ ok: false, reason: 'VEHICLE_NOT_ELIGIBLE', vehicleIds: ['SM-011'] })
  })

  it('tạo lệnh rồi bàn giao cập nhật đúng bộ đếm Hub', () => {
    const ids = eligibleAt('H2').slice(0, 4)
    const h2 = hub('H2').occupiedSlots
    const h5 = { ...hub('H5') }
    const result = S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H5', vehicleIds: ids })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(ids.every((id) => vehicle(id).status === 'IN_TRANSIT')).toBe(true)
    expect(hub('H2').occupiedSlots).toBe(h2 - 4)
    expect(hub('H5').incomingReserved).toBe(h5.incomingReserved + 4)
    S().completeDispatchOrder(result.orderId)
    expect(ids.every((id) => vehicle(id).hubId === 'H5' && vehicle(id).status === 'AVAILABLE')).toBe(true)
    expect(hub('H5')).toMatchObject({ incomingReserved: h5.incomingReserved, occupiedSlots: h5.occupiedSlots + 4 })
  })

  it('hủy lệnh trả xe và bộ đếm về như cũ', () => {
    const ids = eligibleAt('H2').slice(0, 2)
    const before = { h2: { ...hub('H2') }, h5: { ...hub('H5') } }
    const result = S().createDispatchOrder({ sourceHubId: 'H2', destinationHubId: 'H5', vehicleIds: ids })
    if (!result.ok) throw new Error(result.reason)
    S().cancelDispatchOrder(result.orderId)
    expect(hub('H2')).toEqual(before.h2)
    expect(hub('H5')).toEqual(before.h5)
    expect(ids.every((id) => vehicle(id).status === 'AVAILABLE' && vehicle(id).hubId === 'H2')).toBe(true)
  })
})
