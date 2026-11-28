// Charging & Resource Management actions (logic owner: Kiệt): charging queue, charging points,
// manual queue adjustments and vehicle dispatch between Hubs. First version written by Lợi so the
// UI could be wired end to end; Kiệt reviews and takes over. Merged into useMobilityStore.
import type { StateCreator } from 'zustand'
import type { ChargingQueueAdjustment, ChargingRequest, DispatchOrder, Vehicle } from '../types'
import { adjustHub, hubFreeSlots, MINUTE, nextCode, updateById, type Fail } from './storeUtils'
import { isHeartbeatFresh, JOURNEY_RULES } from './vehicleJourneySlice'
import type { MobilityState } from './useMobilityStore'

export const DISPATCH_RULES = {
  minSourceStock: 3, // the source Hub keeps at least 3 ready vehicles after a dispatch
  travelMinutes: 15,
}

export const OPERATOR_NAME = 'Operator Minh'

export type ScheduleResult = { ok: true } | Fail<'NOT_FOUND' | 'POINT_NOT_AVAILABLE' | 'WRONG_HUB' | 'INVALID_STATE'>
export type ChargingActionResult = { ok: true } | Fail<'NOT_FOUND' | 'INVALID_STATE'>
export type MoveQueueResult = { ok: true } | Fail<'NOT_IN_QUEUE' | 'SAME_POSITION' | 'REASON_REQUIRED' | 'INVALID_POSITION'>
export type CreateDispatchResult =
  | { ok: true; orderId: string }
  | Fail<'SAME_HUB' | 'HUB_NOT_FOUND' | 'NO_VEHICLES' | 'DESTINATION_FULL' | 'BELOW_MIN_STOCK'>
  | { ok: false; reason: 'VEHICLE_NOT_ELIGIBLE'; vehicleIds: string[] }

export interface CreateDispatchInput {
  sourceHubId: string
  destinationHubId: string
  vehicleIds: string[]
  origin?: DispatchOrder['origin']
}

export interface ChargingSlice {
  chargingQueueOrder: string[]
  chargingQueueAdjustments: ChargingQueueAdjustment[]
  scheduleChargingRequest: (requestId: string, chargingPointId: string) => ScheduleResult
  autoScheduleCharging: () => number
  moveChargingRequest: (requestId: string, toPosition: number, reason: string) => MoveQueueResult
  startCharging: (requestId: string) => ChargingActionResult
  completeCharging: (requestId: string) => ChargingActionResult
  rescheduleChargingRequest: (requestId: string) => ChargingActionResult
  reportChargingPointFault: (chargingPointId: string) => string | undefined
  restoreChargingPoint: (chargingPointId: string) => void
  expireChargingRequests: (now?: number) => number
  createDispatchOrder: (input: CreateDispatchInput) => CreateDispatchResult
  completeDispatchOrder: (orderId: string) => ChargingActionResult
  cancelDispatchOrder: (orderId: string) => ChargingActionResult
}

// A manual battery value is not trusted to claim the low-battery priority
export const effectiveBattery = (request: ChargingRequest) =>
  request.batteryVerified === false ? Math.max(request.battery, JOURNEY_RULES.minBattery + 1) : request.battery

export const isHighPriority = (request: ChargingRequest) => effectiveBattery(request) <= JOURNEY_RULES.minBattery

// Demo scheduler rule: lower verified battery first, then the longer wait
export const compareQueueRule = (a: ChargingRequest, b: ChargingRequest) =>
  effectiveBattery(a) - effectiveBattery(b) || a.createdAt.localeCompare(b.createdAt) || a.requestId.localeCompare(b.requestId)

// Effective queue: requests placed manually keep their order, new ones slot in by the rule
export const orderChargingQueue = (requests: ChargingRequest[], manualOrder: string[]) => {
  const waiting = requests.filter((request) => request.status === 'WAITING')
  const byId = new Map(waiting.map((request) => [request.requestId, request]))
  const ordered = manualOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  const pinned = new Set(ordered.map((request) => request.requestId))
  for (const request of waiting.filter((item) => !pinned.has(item.requestId)).sort(compareQueueRule)) {
    const index = ordered.findIndex((other) => compareQueueRule(request, other) < 0)
    if (index < 0) ordered.push(request)
    else ordered.splice(index, 0, request)
  }
  return ordered
}

export const isDispatchEligible = (vehicle: Vehicle, now = Date.now()) =>
  vehicle.status === 'AVAILABLE' && vehicle.battery > JOURNEY_RULES.minBattery && !vehicle.faultCode && isHeartbeatFresh(vehicle, now)

export const createChargingSlice: StateCreator<MobilityState, [], [], ChargingSlice> = (set, get) => {
  const releasePoint = (chargingPointId?: string) => (points: MobilityState['chargingPoints']) => points.map((point) =>
    point.chargingPointId === chargingPointId && point.status !== 'ERROR' ? { ...point, status: 'AVAILABLE' as const, vehicleId: undefined } : point)

  return {
    chargingQueueOrder: [],
    chargingQueueAdjustments: [],

    scheduleChargingRequest: (requestId, chargingPointId) => {
      const state = get()
      const point = state.chargingPoints.find((item) => item.chargingPointId === chargingPointId)
      const request = state.chargingRequests.find((item) => item.requestId === requestId)
      if (!point || !request) return { ok: false, reason: 'NOT_FOUND' }
      if (request.status !== 'WAITING') return { ok: false, reason: 'INVALID_STATE' }
      if (point.status !== 'AVAILABLE') return { ok: false, reason: 'POINT_NOT_AVAILABLE' }
      if (point.hubId !== request.hubId) return { ok: false, reason: 'WRONG_HUB' }
      const now = Date.now()
      const desired = request.desiredStart ? new Date(request.desiredStart).getTime() : now
      set((current) => ({
        chargingPoints: updateById(current.chargingPoints, 'chargingPointId', chargingPointId, { status: 'ASSIGNED', vehicleId: request.vehicleId }),
        chargingRequests: updateById(current.chargingRequests, 'requestId', requestId, {
          status: 'SCHEDULED', chargingPointId, scheduledStart: new Date(Math.max(now, desired)).toISOString(),
        }),
      }))
      return { ok: true }
    },

    autoScheduleCharging: () => {
      let scheduled = 0
      for (const request of orderChargingQueue(get().chargingRequests, get().chargingQueueOrder)) {
        const point = get().chargingPoints.filter((item) => item.hubId === request.hubId && item.status === 'AVAILABLE')
          .sort((a, b) => b.powerKw - a.powerKw || a.chargingPointId.localeCompare(b.chargingPointId))[0]
        if (point && get().scheduleChargingRequest(request.requestId, point.chargingPointId).ok) scheduled += 1
      }
      return scheduled
    },

    moveChargingRequest: (requestId, toPosition, reason) => {
      const queue = orderChargingQueue(get().chargingRequests, get().chargingQueueOrder)
      const from = queue.findIndex((request) => request.requestId === requestId)
      if (from < 0) return { ok: false, reason: 'NOT_IN_QUEUE' }
      if (!Number.isInteger(toPosition) || toPosition < 1 || toPosition > queue.length) return { ok: false, reason: 'INVALID_POSITION' }
      if (from === toPosition - 1) return { ok: false, reason: 'SAME_POSITION' }
      if (reason.trim().length < 5) return { ok: false, reason: 'REASON_REQUIRED' }
      const [moved] = queue.splice(from, 1)
      queue.splice(toPosition - 1, 0, moved)
      const now = Date.now()
      set((state) => ({
        chargingQueueOrder: queue.map((request) => request.requestId),
        chargingQueueAdjustments: [...state.chargingQueueAdjustments, {
          adjustmentId: nextCode('ADJ', state.chargingQueueAdjustments.map((item) => item.adjustmentId), now),
          requestId, fromPosition: from + 1, toPosition, reason: reason.trim(), actor: OPERATOR_NAME, at: new Date(now).toISOString(),
        }],
      }))
      return { ok: true }
    },

    // Simulated vehicle handshake: an ASSIGNED point only starts charging once the vehicle is connected
    startCharging: (requestId) => {
      const request = get().chargingRequests.find((item) => item.requestId === requestId)
      if (!request) return { ok: false, reason: 'NOT_FOUND' }
      const point = get().chargingPoints.find((item) => item.chargingPointId === request.chargingPointId)
      if (request.status !== 'SCHEDULED' || !point || point.status !== 'ASSIGNED') return { ok: false, reason: 'INVALID_STATE' }
      set((state) => ({
        chargingRequests: updateById(state.chargingRequests, 'requestId', requestId, { status: 'CHARGING' }),
        chargingPoints: updateById(state.chargingPoints, 'chargingPointId', point.chargingPointId, { status: 'CHARGING', vehicleId: request.vehicleId }),
      }))
      return { ok: true }
    },

    completeCharging: (requestId) => {
      const request = get().chargingRequests.find((item) => item.requestId === requestId)
      if (!request) return { ok: false, reason: 'NOT_FOUND' }
      if (request.status !== 'CHARGING') return { ok: false, reason: 'INVALID_STATE' }
      const now = new Date().toISOString()
      set((state) => ({
        chargingRequests: updateById(state.chargingRequests, 'requestId', requestId, { status: 'FULFILLED' }),
        chargingPoints: releasePoint(request.chargingPointId)(state.chargingPoints),
        vehicles: state.vehicles.map((vehicle) => vehicle.vehicleId !== request.vehicleId ? vehicle : {
          ...vehicle, battery: 100, status: vehicle.status === 'PENDING_CHARGING' && !vehicle.faultCode ? 'AVAILABLE' : vehicle.status,
        }),
        privateEVs: state.privateEVs.map((ev) => ev.evId === request.vehicleId ? { ...ev, battery: 100, lastTelemetryAt: now } : ev),
      }))
      return { ok: true }
    },

    rescheduleChargingRequest: (requestId) => {
      const request = get().chargingRequests.find((item) => item.requestId === requestId)
      if (!request) return { ok: false, reason: 'NOT_FOUND' }
      if (request.status !== 'SCHEDULED') return { ok: false, reason: 'INVALID_STATE' }
      set((state) => ({
        chargingRequests: updateById(state.chargingRequests, 'requestId', requestId, { status: 'WAITING', chargingPointId: undefined, scheduledStart: undefined }),
        chargingPoints: releasePoint(request.chargingPointId)(state.chargingPoints),
      }))
      return { ok: true }
    },

    // Overheating / lost connection: the point goes to ERROR, its request goes back to the queue
    reportChargingPointFault: (chargingPointId) => {
      const point = get().chargingPoints.find((item) => item.chargingPointId === chargingPointId)
      if (!point || point.status === 'ERROR') return undefined
      set((state) => ({
        chargingPoints: updateById(state.chargingPoints, 'chargingPointId', chargingPointId, { status: 'ERROR', vehicleId: undefined }),
        chargingRequests: state.chargingRequests.map((request) => request.chargingPointId === chargingPointId && (request.status === 'SCHEDULED' || request.status === 'CHARGING')
          ? { ...request, status: 'WAITING', chargingPointId: undefined, scheduledStart: undefined } : request),
      }))
      return get().raiseIncident({ assetId: chargingPointId, hubId: point.hubId, title: 'Cổng sạc báo lỗi', severity: 'HIGH', faultCode: 'ERR-CP-FAULT' })
    },

    restoreChargingPoint: (chargingPointId) => set((state) => ({
      chargingPoints: state.chargingPoints.map((point) => point.chargingPointId === chargingPointId && point.status === 'ERROR'
        ? { ...point, status: 'AVAILABLE', vehicleId: undefined } : point),
    })),

    expireChargingRequests: (now = Date.now()) => {
      const expired = get().chargingRequests.filter((request) => (request.status === 'WAITING' || request.status === 'NEEDS_VERIFICATION')
        && request.desiredEnd && now > new Date(request.desiredEnd).getTime())
      if (expired.length === 0) return 0
      const ids = new Set(expired.map((request) => request.requestId))
      set((state) => ({ chargingRequests: state.chargingRequests.map((request) => ids.has(request.requestId) ? { ...request, status: 'EXPIRED' } : request) }))
      return expired.length
    },

    createDispatchOrder: ({ sourceHubId, destinationHubId, vehicleIds, origin = 'MANUAL' }) => {
      const state = get()
      const now = Date.now()
      if (sourceHubId === destinationHubId) return { ok: false, reason: 'SAME_HUB' }
      const source = state.hubs.find((hub) => hub.hubId === sourceHubId)
      const destination = state.hubs.find((hub) => hub.hubId === destinationHubId)
      if (!source || !destination) return { ok: false, reason: 'HUB_NOT_FOUND' }
      const ids = [...new Set(vehicleIds)]
      if (ids.length === 0) return { ok: false, reason: 'NO_VEHICLES' }
      // Revalidate every vehicle against live state before changing anything
      const notEligible = ids.filter((id) => {
        const vehicle = state.vehicles.find((item) => item.vehicleId === id)
        return !vehicle || vehicle.hubId !== sourceHubId || !isDispatchEligible(vehicle, now)
      })
      if (notEligible.length > 0) return { ok: false, reason: 'VEHICLE_NOT_ELIGIBLE', vehicleIds: notEligible }
      const readyAtSource = state.vehicles.filter((vehicle) => vehicle.hubId === sourceHubId && isDispatchEligible(vehicle, now)).length
      if (readyAtSource - ids.length < DISPATCH_RULES.minSourceStock) return { ok: false, reason: 'BELOW_MIN_STOCK' }
      if (hubFreeSlots(destination) < ids.length) return { ok: false, reason: 'DESTINATION_FULL' }

      const order: DispatchOrder = {
        orderId: nextCode('DSP', state.dispatchOrders.map((item) => item.orderId), now),
        sourceHubId, destinationHubId, vehicleIds: ids, status: 'IN_PROGRESS',
        createdAt: new Date(now).toISOString(), etaMinutes: DISPATCH_RULES.travelMinutes, origin,
      }
      const moving = new Set(ids)
      set((current) => ({
        vehicles: current.vehicles.map((vehicle) => moving.has(vehicle.vehicleId) ? { ...vehicle, status: 'IN_TRANSIT' } : vehicle),
        hubs: adjustHub(adjustHub(current.hubs, sourceHubId, { occupiedSlots: -ids.length }), destinationHubId, { incomingReserved: ids.length }),
        dispatchOrders: [...current.dispatchOrders, order],
      }))
      return { ok: true, orderId: order.orderId }
    },

    // Operator confirms the hand-over at the destination Hub
    completeDispatchOrder: (orderId) => {
      const order = get().dispatchOrders.find((item) => item.orderId === orderId)
      if (!order) return { ok: false, reason: 'NOT_FOUND' }
      if (order.status !== 'IN_PROGRESS') return { ok: false, reason: 'INVALID_STATE' }
      const moving = new Set(order.vehicleIds)
      const count = order.vehicleIds.length
      set((state) => ({
        vehicles: state.vehicles.map((vehicle) => moving.has(vehicle.vehicleId) && vehicle.status === 'IN_TRANSIT'
          ? { ...vehicle, hubId: order.destinationHubId, status: 'AVAILABLE' } : vehicle),
        hubs: adjustHub(state.hubs, order.destinationHubId, { incomingReserved: -count, occupiedSlots: count }),
        dispatchOrders: updateById(state.dispatchOrders, 'orderId', orderId, { status: 'COMPLETED', completedAt: new Date().toISOString() }),
      }))
      return { ok: true }
    },

    cancelDispatchOrder: (orderId) => {
      const order = get().dispatchOrders.find((item) => item.orderId === orderId)
      if (!order) return { ok: false, reason: 'NOT_FOUND' }
      if (order.status !== 'IN_PROGRESS') return { ok: false, reason: 'INVALID_STATE' }
      const moving = new Set(order.vehicleIds)
      const count = order.vehicleIds.length
      set((state) => ({
        vehicles: state.vehicles.map((vehicle) => moving.has(vehicle.vehicleId) && vehicle.status === 'IN_TRANSIT'
          ? { ...vehicle, status: 'AVAILABLE' } : vehicle),
        hubs: adjustHub(adjustHub(state.hubs, order.sourceHubId, { occupiedSlots: count }), order.destinationHubId, { incomingReserved: -count }),
        dispatchOrders: updateById(state.dispatchOrders, 'orderId', orderId, { status: 'CANCELLED' }),
      }))
      return { ok: true }
    },
  }
}

export const dispatchEta = (order: DispatchOrder) =>
  order.createdAt ? new Date(new Date(order.createdAt).getTime() + (order.etaMinutes ?? DISPATCH_RULES.travelMinutes) * MINUTE).toISOString() : undefined
