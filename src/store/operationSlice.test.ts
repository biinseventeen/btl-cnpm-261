import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobilityStore } from './useMobilityStore'
import { estimateSimulationSeconds, validateSimulation } from './operationSlice'
import type { SimulationParams } from '../types'

const S = () => useMobilityStore.getState()
const incident = (id: string) => S().incidents.find((item) => item.incidentId === id)!
const vehicle = (id: string) => S().vehicles.find((item) => item.vehicleId === id)!
const point = (id: string) => S().chargingPoints.find((item) => item.chargingPointId === id)!

const params = (overrides: Partial<SimulationParams> = {}): SimulationParams => ({
  scenario: 'DEMAND_SURGE', hubId: 'H2', scope: 'NETWORK', demandChangePct: 80, durationMinutes: 30,
  windowStart: new Date().toISOString(), extraTrips: 6, useSnapshot: true, ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-26T08:00:00+07:00'))
  S().resetDemo()
})
afterEach(() => vi.useRealTimers())

describe('sự cố vận hành', () => {
  it('đánh mã INC tăng dần và ghi lịch sử', () => {
    const id = S().raiseIncident({ assetId: 'SM-002', hubId: 'H2', title: 'Phanh kêu', severity: 'LOW' })
    expect(id).toBe('INC-005')
    expect(incident(id)).toMatchObject({ status: 'OPEN' })
    expect(incident(id).history).toHaveLength(1)
  })

  it('chỉ khôi phục khi sự cố đang xử lý; xe lỗi về AVAILABLE', () => {
    expect(S().restoreIncidentAsset('INC-001')).toEqual({ ok: false, reason: 'INVALID_STATE' })
    const result = S().restoreIncidentAsset('INC-002')
    expect(result.ok).toBe(true)
    expect(vehicle('SM-031')).toMatchObject({ status: 'AVAILABLE', faultCode: undefined })
    expect(incident('INC-002').status).toBe('RESOLVED')
  })

  it('cổng sạc lỗi được khôi phục qua quy trình xác nhận', () => {
    S().notifyTechnician('INC-001')
    S().acknowledgeIncident('INC-001')
    expect(incident('INC-001').status).toBe('IN_PROGRESS')
    S().restoreIncidentAsset('INC-001')
    expect(point('CP-H3-01').status).toBe('AVAILABLE')
  })

  it('xe mất kết nối pin thấp được khôi phục sang Chờ sạc kèm yêu cầu sạc', () => {
    S().setVehicleTelemetry('SM-050', { battery: 10 })
    S().acknowledgeIncident('INC-003')
    S().restoreIncidentAsset('INC-003')
    expect(vehicle('SM-050').status).toBe('PENDING_CHARGING')
    expect(S().chargingRequests.some((item) => item.vehicleId === 'SM-050' && item.status === 'WAITING')).toBe(true)
  })
})

describe('mô phỏng What-if', () => {
  it('kiểm tra tham số (E1)', () => {
    expect(validateSimulation(params(), S().hubs)).toBeUndefined()
    expect(validateSimulation(params({ demandChangePct: -5 }), S().hubs)).toBeTruthy()
    expect(validateSimulation(params({ demandChangePct: 301 }), S().hubs)).toBeTruthy()
    expect(validateSimulation(params({ durationMinutes: 10 }), S().hubs)).toBeTruthy()
    expect(S().runSimulation(params({ demandChangePct: Number.NaN })).status).toBe('INVALID')
  })

  it('quá 30 giây thì TIMEOUT (E2), thu hẹp phạm vi thì chạy được', () => {
    const big = params({ demandChangePct: 300, durationMinutes: 120 })
    expect(estimateSimulationSeconds(big, S().hubs)).toBeGreaterThan(30)
    expect(S().runSimulation(big).status).toBe('TIMEOUT')
    expect(estimateSimulationSeconds(params(), S().hubs)).toBe(5.4)
  })

  it('chạy mô phỏng không làm thay đổi dữ liệu thật', () => {
    const before = JSON.stringify({ hubs: S().hubs, vehicles: S().vehicles, chargingRequests: S().chargingRequests })
    const run = S().runSimulation(params())
    expect(run.status).toBe('COMPLETED')
    expect(run.runId).toBe('SIM-012')
    expect(run.recommendations.length).toBeGreaterThan(0)
    expect(JSON.stringify({ hubs: S().hubs, vehicles: S().vehicles, chargingRequests: S().chargingRequests })).toBe(before)
  })

  it('áp dụng khuyến nghị khi dữ liệu còn đúng thì tạo lệnh điều phối từ mô phỏng', () => {
    const run = S().runSimulation(params())
    const dispatch = run.recommendations.find((item) => item.kind === 'DISPATCH')!
    const [decision] = S().applySimulationRecommendations([dispatch.recommendationId])
    expect(decision.status).toBe('APPLIED')
    expect(S().dispatchOrders.at(-1)).toMatchObject({ origin: 'SIMULATION', sourceHubId: dispatch.sourceHubId })
  })

  it('dữ liệu thật đổi sau snapshot thì khuyến nghị STALE và không đổi gì', () => {
    const run = S().runSimulation(params())
    const dispatch = run.recommendations.find((item) => item.kind === 'DISPATCH')!
    S().simulateWalkInRentals(dispatch.sourceHubId!, 30)
    const orders = S().dispatchOrders.length
    const [decision] = S().applySimulationRecommendations([dispatch.recommendationId])
    expect(decision.status).toBe('STALE')
    expect(decision.reason).toMatch(/cần ít nhất/)
    expect(S().dispatchOrders).toHaveLength(orders)
    expect(S().simulationRun?.recommendations.find((item) => item.recommendationId === dispatch.recommendationId)?.status).toBe('STALE')
  })
})
