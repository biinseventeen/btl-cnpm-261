// Labels and presets of the What-if Simulation screens.
import type { SimulationParams, SimulationScenarioType } from '../../types'

export const scenarioLabel: Record<SimulationScenarioType, string> = {
  DEMAND_SURGE: 'Tăng nhu cầu tại ga Metro',
  HUB_FULL: 'Hub hết chỗ đỗ',
  POWER_OUTAGE: 'Trạm sạc mất điện',
  CHARGER_FAULT: 'Cổng sạc bị lỗi',
  DORM_CONCENTRATION: 'Xe tập trung tại ký túc xá',
}

export const otherScenarios: { scenario: SimulationScenarioType; title: string; text: string; preset: Partial<SimulationParams> }[] = [
  { scenario: 'HUB_FULL', title: 'Hub đầy chỗ đỗ', text: 'Kiểm tra khả năng chuyển hướng người dùng', preset: { hubId: 'H3', demandChangePct: 40, durationMinutes: 30, extraTrips: 4 } },
  { scenario: 'POWER_OUTAGE', title: 'Trạm sạc mất điện', text: 'Đánh giá công suất sạc bị giảm', preset: { hubId: 'H2', demandChangePct: 0, durationMinutes: 60, extraTrips: 0 } },
  { scenario: 'CHARGER_FAULT', title: 'Cổng sạc bị lỗi', text: 'Mô phỏng mất một phần cổng sạc', preset: { hubId: 'H1', demandChangePct: 20, durationMinutes: 30, extraTrips: 0 } },
  { scenario: 'DORM_CONCENTRATION', title: 'Xe tập trung tại KTX', text: 'Kiểm tra mất cân bằng phân bổ xe', preset: { hubId: 'H1', demandChangePct: 60, durationMinutes: 60, extraTrips: 0 } },
]

export const defaultWindowStart = () => {
  const date = new Date()
  date.setHours(9, 0, 0, 0)
  return date.toISOString()
}

export const defaultParams = (): SimulationParams => ({
  scenario: 'DEMAND_SURGE', hubId: 'H2', scope: 'NETWORK', demandChangePct: 80, durationMinutes: 30,
  windowStart: defaultWindowStart(), extraTrips: 6, useSnapshot: true,
})

export const snapshotCode = (iso: string) => {
  const date = new Date(iso)
  return `SIM-S${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
}

export const formatDemand = (value: number) => `${value > 0 ? '+' : ''}${value}%`
