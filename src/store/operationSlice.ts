// Operation & What-if Simulation actions (logic owner: Thịnh): incident handling and the
// simulation engine. First version written by Lợi so the UI could be wired end to end; Thịnh
// reviews and takes over. Merged into useMobilityStore.
//
// The simulation only reads a snapshot. Applying a recommendation revalidates it against live
// state; anything that no longer holds is marked STALE and changes nothing.
import type { StateCreator } from 'zustand'
import type {
  ChargingRequest, Hub, IncidentSeverity, OperationalIncident, SimulationHubResult, SimulationParams,
  SimulationRecommendation, SimulationRun, Vehicle,
} from '../types'
import { DISPATCH_RULES, isDispatchEligible, isHighPriority, orderChargingQueue } from './chargingSlice'
import { adjustHub, hubFreeSlots, nextCode, updateById, type Fail } from './storeUtils'
import { JOURNEY_RULES } from './vehicleJourneySlice'
import type { MobilityState } from './useMobilityStore'

export type NewIncident = Pick<OperationalIncident, 'assetId' | 'hubId' | 'title' | 'severity'> & { faultCode?: string }

export type IncidentActionResult = { ok: true } | Fail<'NOT_FOUND' | 'INVALID_STATE'>
export type RestoreAssetResult = { ok: true; summary: string } | Fail<'NOT_FOUND' | 'INVALID_STATE'>

export interface RecommendationDecision {
  recommendationId: string
  status: 'APPLIED' | 'STALE'
  reason?: string
}

export const SIMULATION_LIMITS = {
  maxSeconds: 30,
  minDemandPct: 0,
  maxDemandPct: 300,
  minDuration: 15,
  maxDuration: 120,
  localHubs: 3,
}

export interface OperationSlice {
  incidents: OperationalIncident[]
  simulationRun?: SimulationRun
  raiseIncident: (incident: NewIncident) => string
  notifyTechnician: (incidentId: string) => IncidentActionResult
  acknowledgeIncident: (incidentId: string) => IncidentActionResult
  resolveIncident: (incidentId: string) => IncidentActionResult
  restoreIncidentAsset: (incidentId: string) => RestoreAssetResult
  runSimulation: (params: SimulationParams) => SimulationRun
  applySimulationRecommendations: (recommendationIds: string[]) => RecommendationDecision[]
  clearSimulation: () => void
  // Demo only: walk-in rentals change live data after a snapshot (SIM-03 stale case)
  simulateWalkInRentals: (hubId: string, count: number) => number
}

export const SEVERITY_RANK: Record<IncidentSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

const nowIso = () => new Date().toISOString()
const withHistory = (incident: OperationalIncident, action: string, change: Partial<OperationalIncident> = {}): OperationalIncident => ({
  ...incident, ...change, history: [...(incident.history ?? []), { at: nowIso(), action }],
})

export const validateSimulation = (params: SimulationParams, hubs: Hub[]): string | undefined => {
  if (!hubs.some((hub) => hub.hubId === params.hubId)) return 'Hub bị ảnh hưởng không tồn tại.'
  if (!Number.isFinite(params.demandChangePct) || params.demandChangePct < SIMULATION_LIMITS.minDemandPct || params.demandChangePct > SIMULATION_LIMITS.maxDemandPct) {
    return `Mức tăng nhu cầu không được âm hoặc vượt sức chứa thiết kế (${SIMULATION_LIMITS.minDemandPct}–${SIMULATION_LIMITS.maxDemandPct}%). Vui lòng điều chỉnh để tiếp tục.`
  }
  if (!Number.isInteger(params.durationMinutes) || params.durationMinutes < SIMULATION_LIMITS.minDuration || params.durationMinutes > SIMULATION_LIMITS.maxDuration) {
    return `Thời gian giả lập phải từ ${SIMULATION_LIMITS.minDuration} đến ${SIMULATION_LIMITS.maxDuration} phút.`
  }
  if (!Number.isInteger(params.extraTrips) || params.extraTrips < 0 || params.extraTrips > 200) return 'Lượt xe bổ sung phải là số nguyên từ 0 đến 200.'
  if (!params.windowStart || Number.isNaN(new Date(params.windowStart).getTime())) return 'Khung giờ giả lập không hợp lệ.'
  return undefined
}

export const scopeHubCount = (params: Pick<SimulationParams, 'scope'>, hubs: Hub[]) =>
  params.scope === 'NETWORK' ? hubs.length : Math.min(SIMULATION_LIMITS.localHubs, hubs.length)

// Cost model of the demo engine: grows with the Hubs in scope, the simulated time and the demand
export const estimateSimulationSeconds = (params: SimulationParams, hubs: Hub[]) =>
  Math.round(0.02 * scopeHubCount(params, hubs) * params.durationMinutes * (1 + params.demandChangePct / 100) * 10) / 10

// Hubs in a LOCAL run: the focus Hub and its nearest neighbours in list order
const hubsInScope = (params: SimulationParams, hubs: Hub[]) => {
  if (params.scope === 'NETWORK') return hubs
  const focus = hubs.findIndex((hub) => hub.hubId === params.hubId)
  return [hubs[focus], ...hubs.filter((_, index) => index !== focus)].slice(0, SIMULATION_LIMITS.localHubs)
}

interface EngineInput {
  hubs: Hub[]
  vehicles: Vehicle[]
  chargingRequests: ChargingRequest[]
  chargingPoints: MobilityState['chargingPoints']
  chargingQueueOrder: string[]
}

const DORM_HUBS = ['H1', 'H3']

// Pure engine so it can be tested and reasoned about without the store
export const simulate = (params: SimulationParams, input: EngineInput, runSeq: number, now: number) => {
  const scope = hubsInScope(params, input.hubs)
  const eligible = (hubId: string) => input.vehicles.filter((vehicle) => vehicle.hubId === hubId && isDispatchEligible(vehicle, now))
  const results = new Map<string, SimulationHubResult>(scope.map((hub) => {
    const available = eligible(hub.hubId).length
    const parked = hub.occupiedSlots + hub.heldSlots + hub.incomingReserved
    return [hub.hubId, {
      hubId: hub.hubId, totalSlots: hub.totalSlots, snapshotAvailable: available, snapshotParked: parked,
      afterDemandAvailable: available, afterDemandParked: parked, afterPlanAvailable: available, afterPlanParked: parked,
    }]
  }))
  const focus = results.get(params.hubId)!
  const factor = (params.demandChangePct / 100) * (params.durationMinutes / 60)

  // 1. Apply the scenario to the snapshot
  if (params.scenario === 'DEMAND_SURGE') {
    const pickups = Math.min(focus.snapshotAvailable, Math.round(focus.snapshotAvailable * factor) + params.extraTrips)
    focus.afterDemandAvailable -= pickups
    focus.afterDemandParked -= pickups
  } else if (params.scenario === 'HUB_FULL') {
    const arrivals = Math.round(focus.totalSlots * factor) + params.extraTrips
    focus.afterDemandParked += arrivals
    focus.afterDemandAvailable += arrivals
  } else if (params.scenario === 'DORM_CONCENTRATION') {
    const dorms = [...results.values()].filter((item) => DORM_HUBS.includes(item.hubId))
    for (const item of results.values()) {
      if (DORM_HUBS.includes(item.hubId)) continue
      const leaving = Math.min(item.afterDemandAvailable, Math.round(item.afterDemandAvailable * factor / 2))
      item.afterDemandAvailable -= leaving
      item.afterDemandParked -= leaving
      dorms.forEach((dorm, index) => {
        const share = Math.floor(leaving / dorms.length) + (index < leaving % dorms.length ? 1 : 0)
        dorm.afterDemandAvailable += share
        dorm.afterDemandParked += share
      })
    }
  }
  for (const item of results.values()) {
    item.afterPlanAvailable = item.afterDemandAvailable
    item.afterPlanParked = item.afterDemandParked
  }

  const recommendations: SimulationRecommendation[] = []
  const recId = () => `KN-${String(runSeq).padStart(3, '0')}-${recommendations.length + 1}`
  const name = (hubId?: string) => input.hubs.find((hub) => hub.hubId === hubId)?.name ?? hubId ?? '—'
  const free = (item: SimulationHubResult) => Math.max(0, item.totalSlots - item.afterPlanParked)

  // 2. Dispatch: refill the Hub with the biggest shortage (or empty the overflowing Hub)
  const dispatchPlan = (() => {
    if (params.scenario === 'HUB_FULL') {
      const overflow = Math.max(0, focus.afterPlanParked - focus.totalSlots)
      const destination = [...results.values()].filter((item) => item.hubId !== focus.hubId).sort((a, b) => free(b) - free(a))[0]
      return overflow > 0 && destination ? { source: focus, destination, need: overflow } : undefined
    }
    const shortage = (item: SimulationHubResult) => Math.ceil(item.snapshotAvailable * 0.7) - item.afterPlanAvailable
    const destination = [...results.values()].sort((a, b) => shortage(b) - shortage(a))[0]
    if (!destination || shortage(destination) <= 0) return undefined
    const source = [...results.values()].filter((item) => item.hubId !== destination.hubId)
      .sort((a, b) => (b.afterPlanAvailable - a.afterPlanAvailable) || a.hubId.localeCompare(b.hubId))[0]
    return source ? { source, destination, need: shortage(destination) } : undefined
  })()
  if (dispatchPlan) {
    const { source, destination, need } = dispatchPlan
    const spare = Math.min(eligible(source.hubId).length, source.afterPlanAvailable) - DISPATCH_RULES.minSourceStock
    // The order is created against live counters, so it can only use the slots that are free right now
    const liveFree = hubFreeSlots(input.hubs.find((hub) => hub.hubId === destination.hubId)!)
    const move = Math.min(need, spare, free(destination), liveFree)
    if (move > 0) {
      const vehicleIds = eligible(source.hubId).sort((a, b) => b.battery - a.battery || a.vehicleId.localeCompare(b.vehicleId))
        .slice(0, move).map((vehicle) => vehicle.vehicleId)
      source.afterPlanAvailable -= move
      source.afterPlanParked -= move
      destination.afterPlanAvailable += move
      destination.afterPlanParked += move
      const minSource = move + DISPATCH_RULES.minSourceStock
      recommendations.push({
        recommendationId: recId(), kind: 'DISPATCH', status: 'PROPOSED',
        title: `Điều phối ${move} xe từ ${name(source.hubId)} → ${name(destination.hubId)}`,
        description: `${source.snapshotAvailable} xe sẵn sàng tại nguồn, ${name(destination.hubId)} còn ${destination.afterDemandAvailable} xe sau kịch bản. Chỉ lấy xe sẵn sàng, pin trên ${JOURNEY_RULES.minBattery}%; nguồn giữ tối thiểu ${DISPATCH_RULES.minSourceStock} xe.`,
        precheck: `${name(source.hubId)} còn ít nhất ${minSource} xe sẵn sàng · ${name(destination.hubId)} còn ít nhất ${move} chỗ trống`,
        sourceHubId: source.hubId, destinationHubId: destination.hubId, vehicleIds,
        minSourceAvailable: minSource, minDestinationFree: move,
      })
    }
  }

  // 3. Charging priority for low-battery requests where a point is free
  const outageHub = params.scenario === 'POWER_OUTAGE' ? params.hubId : undefined
  const queue = orderChargingQueue(input.chargingRequests, input.chargingQueueOrder).filter((request) => isHighPriority(request))
  const freePoints = (hubId: string) => input.chargingPoints.filter((point) => point.hubId === hubId && point.status === 'AVAILABLE').length
    - (params.scenario === 'CHARGER_FAULT' && hubId === params.hubId ? 1 : 0)
  const priorityHub = [params.hubId, ...scope.map((hub) => hub.hubId)].find((hubId) =>
    hubId !== outageHub && freePoints(hubId) > 0 && queue.some((request) => request.hubId === hubId))
  if (priorityHub) {
    const picked = queue.filter((request) => request.hubId === priorityHub).slice(0, Math.min(2, freePoints(priorityHub)))
    recommendations.push({
      recommendationId: recId(), kind: 'CHARGING_PRIORITY', status: 'PROPOSED',
      title: `Ưu tiên ${picked.length} xe pin thấp tại ${name(priorityHub)}`,
      description: `${picked.map((request) => `${request.vehicleId} (${request.battery}%)`).join(' và ')} xếp trước để kịp quay lại phục vụ khi nhu cầu tăng.`,
      precheck: `${picked.map((request) => request.vehicleId).join(' và ')} vẫn đang chờ sạc · ${name(priorityHub)} còn ít nhất ${picked.length} cổng trống`,
      destinationHubId: priorityHub, requestIds: picked.map((request) => request.requestId),
    })
  }

  // 4. Redirect returning users away from Hubs that stay full
  const fullAfter = [...results.values()].filter((item) => item.afterPlanParked >= item.totalSlots)
  const roomiest = [...results.values()].filter((item) => !fullAfter.includes(item)).sort((a, b) => free(b) - free(a))[0]
  const redirectSource = outageHub ? results.get(outageHub) : fullAfter[0]
  if (redirectSource && roomiest && free(roomiest) > 0) {
    const keep = Math.min(10, free(roomiest))
    recommendations.push({
      recommendationId: recId(), kind: 'REDIRECT', status: 'PROPOSED',
      title: outageHub ? `Chuyển yêu cầu sạc khỏi ${name(outageHub)}` : 'Chuyển hướng khách đến Hub còn chỗ',
      description: outageHub
        ? `${name(outageHub)} mất điện trong ${params.durationMinutes} phút. Đề xuất hướng xe cần sạc đến ${name(roomiest.hubId)} (${freePoints(roomiest.hubId)} cổng trống).`
        : `${name(redirectSource.hubId)} không còn chỗ sau kịch bản. Đề xuất hướng khách trả xe đến ${name(roomiest.hubId)} (${free(roomiest)} chỗ sau phương án).`,
      precheck: `${name(redirectSource.hubId)} vẫn ${outageHub ? 'mất điện' : 'đầy'} · ${name(roomiest.hubId)} còn ít nhất ${keep} chỗ`,
      sourceHubId: redirectSource.hubId, destinationHubId: roomiest.hubId, minDestinationFree: keep,
    })
  }

  return { hubResults: [...results.values()], recommendations }
}

export const createOperationSlice: StateCreator<MobilityState, [], [], OperationSlice> = (set, get) => {
  const updateIncident = (incidentId: string, change: (incident: OperationalIncident) => OperationalIncident) =>
    set((state) => ({ incidents: state.incidents.map((incident) => incident.incidentId === incidentId ? change(incident) : incident) }))

  return {
    incidents: [],
    simulationRun: undefined,

    raiseIncident: (incident) => {
      const incidents = get().incidents
      const max = incidents.reduce((highest, item) => Math.max(highest, Number(item.incidentId.split('-').pop()) || 0), 0)
      const incidentId = `INC-${String(max + 1).padStart(3, '0')}`
      const at = nowIso()
      set((state) => ({
        incidents: [...state.incidents, { ...incident, incidentId, status: 'OPEN', createdAt: at, history: [{ at, action: `Hệ thống ghi nhận: ${incident.title}` }] }],
      }))
      return incidentId
    },

    notifyTechnician: (incidentId) => {
      const incident = get().incidents.find((item) => item.incidentId === incidentId)
      if (!incident) return { ok: false, reason: 'NOT_FOUND' }
      if (incident.status === 'RESOLVED') return { ok: false, reason: 'INVALID_STATE' }
      updateIncident(incidentId, (item) => withHistory(item, 'Đã gửi thông báo đội kỹ thuật', { technicianNotifiedAt: nowIso() }))
      return { ok: true }
    },

    acknowledgeIncident: (incidentId) => {
      const incident = get().incidents.find((item) => item.incidentId === incidentId)
      if (!incident) return { ok: false, reason: 'NOT_FOUND' }
      if (incident.status !== 'OPEN') return { ok: false, reason: 'INVALID_STATE' }
      updateIncident(incidentId, (item) => withHistory(item, 'Operator xác nhận đang xử lý', { status: 'IN_PROGRESS' }))
      return { ok: true }
    },

    // Closes the ticket only; the asset stays blocked until restoreIncidentAsset is used
    resolveIncident: (incidentId) => {
      const incident = get().incidents.find((item) => item.incidentId === incidentId)
      if (!incident) return { ok: false, reason: 'NOT_FOUND' }
      if (incident.status === 'RESOLVED') return { ok: false, reason: 'INVALID_STATE' }
      updateIncident(incidentId, (item) => withHistory(item, 'Đóng sự cố, tài nguyên giữ nguyên trạng thái', { status: 'RESOLVED', resolvedAt: nowIso() }))
      return { ok: true }
    },

    // Technician confirmed the repair: resolve and bring the asset back through a validated transition
    restoreIncidentAsset: (incidentId) => {
      const state = get()
      const incident = state.incidents.find((item) => item.incidentId === incidentId)
      if (!incident) return { ok: false, reason: 'NOT_FOUND' }
      if (incident.status !== 'IN_PROGRESS') return { ok: false, reason: 'INVALID_STATE' }
      let summary = 'Tài nguyên không cần khôi phục.'
      const vehicle = state.vehicles.find((item) => item.vehicleId === incident.assetId)
      const point = state.chargingPoints.find((item) => item.chargingPointId === incident.assetId)
      const slot = state.parkingSlots.find((item) => item.slotId === incident.assetId)
      if (vehicle && (vehicle.status === 'UNAVAILABLE' || vehicle.status === 'DISCONNECTED' || vehicle.faultCode)) {
        const lowBattery = vehicle.battery <= JOURNEY_RULES.minBattery
        const parked = vehicle.status === 'UNAVAILABLE' || vehicle.status === 'DISCONNECTED'
        const status = !parked ? vehicle.status : lowBattery ? 'PENDING_CHARGING' : 'AVAILABLE'
        const hasRequest = state.chargingRequests.some((request) => request.vehicleId === vehicle.vehicleId && ['WAITING', 'SCHEDULED', 'CHARGING'].includes(request.status))
        const now = Date.now()
        set((current) => ({
          vehicles: updateById(current.vehicles, 'vehicleId', vehicle.vehicleId, { status, faultCode: undefined, lastHeartbeat: new Date(now).toISOString() }),
          chargingRequests: status === 'PENDING_CHARGING' && !hasRequest ? [...current.chargingRequests, {
            requestId: nextCode('CR', current.chargingRequests.map((request) => request.requestId), now), source: 'SYSTEM',
            vehicleId: vehicle.vehicleId, hubId: vehicle.hubId, battery: vehicle.battery, batteryVerified: true,
            status: 'WAITING', createdAt: new Date(now).toISOString(),
          }] : current.chargingRequests,
        }))
        summary = status === 'PENDING_CHARGING' ? `${vehicle.vehicleId} hết lỗi nhưng pin ${vehicle.battery}%, chuyển sang Chờ sạc.` : `${vehicle.vehicleId} chuyển về ${status === 'AVAILABLE' ? 'Sẵn sàng' : 'trạng thái trước đó'}.`
      } else if (point && point.status === 'ERROR') {
        get().restoreChargingPoint(point.chargingPointId)
        summary = `${point.chargingPointId} chuyển về Trống.`
      } else if (slot && (slot.sensorStatus !== 'ONLINE' || slot.status === 'UNAVAILABLE')) {
        set((current) => ({
          parkingSlots: current.parkingSlots.map((item) => item.slotId === slot.slotId
            ? { ...item, sensorStatus: 'ONLINE', status: item.status === 'UNAVAILABLE' ? 'FREE' : item.status } : item),
        }))
        summary = `Ô ${slot.slotId} có cảm biến hoạt động trở lại.`
      }
      updateIncident(incidentId, (item) => withHistory(item, `Đội kỹ thuật xác nhận đã sửa. ${summary}`, { status: 'RESOLVED', resolvedAt: nowIso() }))
      return { ok: true, summary }
    },

    runSimulation: (params) => {
      const state = get()
      const now = Date.now()
      const runSeq = (Number(state.simulationRun?.runId.split('-').pop()) || 11) + 1
      const snapshotDate = new Date(now)
      const base = {
        runId: `SIM-${String(runSeq).padStart(3, '0')}`,
        snapshotId: `SIM-S${String(snapshotDate.getHours()).padStart(2, '0')}${String(snapshotDate.getMinutes()).padStart(2, '0')}`,
        snapshotAt: snapshotDate.toISOString(), params,
        estimatedSeconds: 0, hubResults: [], recommendations: [],
      }
      const error = validateSimulation(params, state.hubs)
      let run: SimulationRun
      if (error) {
        run = { ...base, status: 'INVALID', error }
      } else {
        const estimatedSeconds = estimateSimulationSeconds(params, state.hubs)
        run = estimatedSeconds > SIMULATION_LIMITS.maxSeconds
          ? { ...base, estimatedSeconds, status: 'TIMEOUT', error: `Quy mô kịch bản quá lớn. Đề xuất: giảm phạm vi xuống ≤ ${SIMULATION_LIMITS.localHubs} Hub hoặc rút ngắn khung giờ giả lập.` }
          : { ...base, estimatedSeconds, status: 'COMPLETED', ...simulate(params, state, runSeq, now) }
      }
      set({ simulationRun: run })
      return run
    },

    applySimulationRecommendations: (recommendationIds) => {
      const run = get().simulationRun
      if (!run || run.status !== 'COMPLETED') return []
      const decisions: RecommendationDecision[] = []
      const hubName = (hubId?: string) => get().hubs.find((hub) => hub.hubId === hubId)?.name ?? hubId
      for (const recommendation of run.recommendations.filter((item) => recommendationIds.includes(item.recommendationId) && item.status === 'PROPOSED')) {
        const live = get()
        const now = Date.now()
        let reason: string | undefined
        if (recommendation.kind === 'DISPATCH') {
          const eligible = live.vehicles.filter((vehicle) => vehicle.hubId === recommendation.sourceHubId && isDispatchEligible(vehicle, now))
          const destination = live.hubs.find((hub) => hub.hubId === recommendation.destinationHubId)
          const need = recommendation.vehicleIds?.length ?? 0
          if (eligible.length < (recommendation.minSourceAvailable ?? 0)) {
            reason = `${hubName(recommendation.sourceHubId)}: cần ít nhất ${recommendation.minSourceAvailable} xe, hiện còn ${eligible.length}`
          } else if (!destination || hubFreeSlots(destination) < (recommendation.minDestinationFree ?? 0)) {
            reason = `${hubName(recommendation.destinationHubId)}: cần ${recommendation.minDestinationFree} chỗ trống, hiện còn ${destination ? hubFreeSlots(destination) : 0}`
          } else {
            // Keep the previewed vehicles that are still eligible, top up with other eligible ones
            const stillOk = (recommendation.vehicleIds ?? []).filter((id) => eligible.some((vehicle) => vehicle.vehicleId === id))
            const extra = eligible.filter((vehicle) => !stillOk.includes(vehicle.vehicleId)).sort((a, b) => b.battery - a.battery).map((vehicle) => vehicle.vehicleId)
            const result = live.createDispatchOrder({
              sourceHubId: recommendation.sourceHubId!, destinationHubId: recommendation.destinationHubId!,
              vehicleIds: [...stillOk, ...extra].slice(0, need), origin: 'SIMULATION',
            })
            if (!result.ok) reason = `Không tạo được lệnh điều phối (${result.reason})`
          }
        } else if (recommendation.kind === 'CHARGING_PRIORITY') {
          const requests = (recommendation.requestIds ?? []).map((id) => live.chargingRequests.find((request) => request.requestId === id))
          const freePoints = live.chargingPoints.filter((point) => point.hubId === recommendation.destinationHubId && point.status === 'AVAILABLE')
          const gone = requests.find((request) => !request || request.status !== 'WAITING')
          if (gone !== undefined || requests.length === 0) reason = `${gone?.vehicleId ?? 'Yêu cầu'} không còn ở trạng thái chờ sạc`
          else if (freePoints.length < requests.length) reason = `${hubName(recommendation.destinationHubId)} chỉ còn ${freePoints.length} cổng trống`
          else requests.forEach((request, index) => live.scheduleChargingRequest(request!.requestId, freePoints[index].chargingPointId))
        } else {
          const destination = live.hubs.find((hub) => hub.hubId === recommendation.destinationHubId)
          if (!destination || hubFreeSlots(destination) < (recommendation.minDestinationFree ?? 0)) {
            reason = `${hubName(recommendation.destinationHubId)}: cần ít nhất ${recommendation.minDestinationFree} chỗ, hiện còn ${destination ? hubFreeSlots(destination) : 0}`
          }
        }
        decisions.push({ recommendationId: recommendation.recommendationId, status: reason ? 'STALE' : 'APPLIED', reason })
      }
      const decided = new Map(decisions.map((decision) => [decision.recommendationId, decision]))
      const decidedAt = nowIso()
      set((state) => state.simulationRun ? {
        simulationRun: {
          ...state.simulationRun,
          recommendations: state.simulationRun.recommendations.map((item) => {
            const decision = decided.get(item.recommendationId)
            return decision ? { ...item, status: decision.status, staleReason: decision.reason, decidedAt } : item
          }),
        },
      } : {})
      return decisions
    },

    clearSimulation: () => set({ simulationRun: undefined }),

    simulateWalkInRentals: (hubId, count) => {
      const now = Date.now()
      const picked = get().vehicles.filter((vehicle) => vehicle.hubId === hubId && isDispatchEligible(vehicle, now)).slice(0, count)
      if (picked.length === 0) return 0
      const ids = new Set(picked.map((vehicle) => vehicle.vehicleId))
      set((state) => ({
        vehicles: state.vehicles.map((vehicle) => ids.has(vehicle.vehicleId) ? { ...vehicle, status: 'IN_USE' } : vehicle),
        hubs: adjustHub(state.hubs, hubId, { occupiedSlots: -picked.length }),
      }))
      return picked.length
    },
  }
}
