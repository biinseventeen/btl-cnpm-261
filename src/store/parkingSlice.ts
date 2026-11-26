// Parking & Private EV actions (owner: Lợi). Merged into useMobilityStore.
// Capacity uses the shared Hub counters: a reservation holds one unit (heldSlots) until the
// slot sensor confirms the vehicle, then the unit moves to occupiedSlots.
import type { StateCreator } from 'zustand'
import { initialChargingRequestEvents } from '../data/mockData'
import type {
  ChargingRequest, ChargingRequestEvent, ChargingRequestStatus, Hub, ParkingFailureReason,
  ParkingReservation, ParkingReservationStatus, ParkingSensorStatus, ParkingSlot,
} from '../types'
import type { MobilityState } from './useMobilityStore'

export const PARKING_RULES = {
  maxLeadMinutes: 120, // book at most 2 hours ahead
  capacityGraceMinutes: 15, // capacity hold lasts until arrivalTime + 15 minutes
  slotHoldMinutes: 10, // assigned slot waits 10 minutes for the sensor
  telemetryMaxAgeMinutes: 30, // older battery telemetry must be entered manually
}

export const OPEN_RESERVATION_STATUSES: ParkingReservationStatus[] = ['HELD', 'SLOT_ASSIGNED', 'ARRIVED']
export const ACTIVE_CHARGING_STATUSES: ChargingRequestStatus[] = ['NEEDS_VERIFICATION', 'WAITING', 'SCHEDULED', 'CHARGING']
export const CANCELLABLE_CHARGING_STATUSES: ChargingRequestStatus[] = ['NEEDS_VERIFICATION', 'WAITING', 'SCHEDULED']

type Fail<R extends string> = { ok: false; reason: R }

export type ReserveParkingResult =
  | { ok: true; reservationId: string }
  | Fail<'HUB_NOT_FOUND' | 'HUB_FULL' | 'DUPLICATE_RESERVATION' | 'INVALID_ARRIVAL_TIME' | 'EV_NOT_OWNED'>

export type ReservationActionResult = { ok: true } | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE'>

export type CheckInResult =
  | { ok: true; slotId: string }
  | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE' | 'EXPIRED' | ParkingFailureReason>

export type SensorReportOutcome =
  | 'ARRIVED' | 'COMPLETED' | 'UNEXPECTED_OCCUPANCY' | 'VEHICLE_LEFT' | 'IGNORED'

export type SubmitChargingResult =
  | { ok: true; requestId: string }
  | Fail<'EV_NOT_FOUND' | 'NOT_OWNER' | 'HUB_NOT_FOUND' | 'INVALID_WINDOW' | 'DUPLICATE_REQUEST'
    | 'BATTERY_REQUIRED' | 'INVALID_BATTERY' | 'BATTERY_NOT_CONFIRMED'>

export type CancelChargingResult = { ok: true } | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE'>

export interface SubmitChargingInput {
  studentId: string
  evId: string
  hubId: string
  desiredStart: string
  desiredEnd: string
  nextUseAt?: string
  manualBattery?: number
  manualBatteryConfirmed?: boolean
}

export interface ParkingSlice {
  chargingRequestEvents: ChargingRequestEvent[]
  reserveParking: (input: { studentId: string; hubId: string; arrivalTime: string; evId?: string }) => ReserveParkingResult
  cancelParkingReservation: (studentId: string, reservationId: string) => ReservationActionResult
  checkInParking: (studentId: string, reservationId: string) => CheckInResult
  checkOutParking: (studentId: string, reservationId: string) => ReservationActionResult
  reportSlotSensor: (slotId: string, reading: 'OCCUPIED' | 'FREE') => SensorReportOutcome
  setSlotSensorStatus: (slotId: string, sensorStatus: ParkingSensorStatus) => void
  sweepParkingExpiry: (now?: number) => number
  submitPrivateEvChargingRequest: (input: SubmitChargingInput) => SubmitChargingResult
  cancelChargingRequest: (studentId: string, requestId: string) => CancelChargingResult
  recordChargingRequestChanges: (previous: ChargingRequest[], next: ChargingRequest[]) => void
}

const MINUTE = 60 * 1000

export const availableCapacity = (hub: Hub) => Math.max(0, hub.totalSlots - hub.occupiedSlots - hub.heldSlots - hub.incomingReserved)

export const isTelemetryFresh = (lastTelemetryAt: string | undefined, now = Date.now()) =>
  !!lastTelemetryAt && now - new Date(lastTelemetryAt).getTime() <= PARKING_RULES.telemetryMaxAgeMinutes * MINUTE

const dateStamp = (now: number) => {
  const date = new Date(now)
  return `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

const nextCode = (prefix: string, existingIds: string[], now: number) => {
  const max = existingIds.filter((id) => id.startsWith(`${prefix}-`))
    .reduce((highest, id) => Math.max(highest, Number(id.split('-').pop()) || 0), 0)
  return `${prefix}-${dateStamp(now)}-${String(max + 1).padStart(3, '0')}`
}

const updateHub = (hubs: Hub[], hubId: string, change: Partial<Record<'heldSlots' | 'occupiedSlots', number>>) =>
  hubs.map((hub) => hub.hubId === hubId ? {
    ...hub,
    heldSlots: Math.max(0, hub.heldSlots + (change.heldSlots ?? 0)),
    occupiedSlots: Math.max(0, hub.occupiedSlots + (change.occupiedSlots ?? 0)),
  } : hub)

const updateById = <T, K extends keyof T>(items: T[], key: K, id: T[K], change: Partial<T>) =>
  items.map((item) => item[key] === id ? { ...item, ...change } : item)

const freeSlot = (slots: ParkingSlot[], slotId: string | undefined) => slotId
  ? slots.map((slot) => slot.slotId === slotId ? { ...slot, status: 'FREE' as const, vehicleId: undefined } : slot)
  : slots

// Turns two snapshots of the charging queue into history events for student (private EV) requests.
export const diffChargingRequests = (previous: ChargingRequest[], next: ChargingRequest[], at: string): Omit<ChargingRequestEvent, 'eventId'>[] => {
  const before = new Map(previous.map((request) => [request.requestId, request]))
  const events: Omit<ChargingRequestEvent, 'eventId'>[] = []
  for (const request of next) {
    if (request.source !== 'STUDENT') continue
    const old = before.get(request.requestId)
    const base = { requestId: request.requestId, at, chargingPointId: request.chargingPointId, scheduledStart: request.scheduledStart }
    if (!old) {
      events.push({ ...base, type: 'SUBMITTED' })
      continue
    }
    const previousSchedule = { previousChargingPointId: old.chargingPointId, previousScheduledStart: old.scheduledStart }
    if (old.status === request.status) {
      if (request.status === 'SCHEDULED' && (old.chargingPointId !== request.chargingPointId || old.scheduledStart !== request.scheduledStart)) {
        // Same point with a start time filled in for the first time completes the schedule, it is not a change
        const completed = old.chargingPointId === request.chargingPointId && !old.scheduledStart
        events.push(completed ? { ...base, type: 'SCHEDULED' } : { ...base, ...previousSchedule, type: 'SCHEDULE_CHANGED' })
      }
      continue
    }
    switch (request.status) {
      case 'SCHEDULED': events.push({ ...base, type: 'SCHEDULED' }); break
      case 'WAITING': if (old.status === 'SCHEDULED') events.push({ ...base, ...previousSchedule, type: 'RESCHEDULED' }); break
      case 'CHARGING': events.push({ ...base, type: 'CHARGING' }); break
      case 'FULFILLED': events.push({ ...base, type: 'FULFILLED' }); break
      case 'EXPIRED': events.push({ ...base, ...previousSchedule, type: 'EXPIRED' }); break
      case 'CANCELLED': events.push({ ...base, ...previousSchedule, type: 'CANCELLED' }); break
    }
  }
  return events
}

export const createParkingSlice: StateCreator<MobilityState, [], [], ParkingSlice> = (set, get) => {
  // Releases the capacity (and slot) held by a reservation that ends before the vehicle arrives.
  const endHeldReservation = (reservation: ParkingReservation, status: 'CANCELLED' | 'EXPIRED' | 'CHECK_IN_FAILED', extra: Partial<ParkingReservation> = {}) =>
    set((state) => ({
      parkingReservations: updateById(state.parkingReservations, 'reservationId', reservation.reservationId, { status, ...extra }),
      parkingSlots: reservation.status === 'SLOT_ASSIGNED' ? freeSlot(state.parkingSlots, reservation.slotId) : state.parkingSlots,
      hubs: updateHub(state.hubs, reservation.hubId, { heldSlots: -1 }),
    }))

  const completeReservation = (reservation: ParkingReservation) => set((state) => ({
    parkingReservations: updateById(state.parkingReservations, 'reservationId', reservation.reservationId, { status: 'COMPLETED' }),
    parkingSlots: freeSlot(state.parkingSlots, reservation.slotId),
    hubs: updateHub(state.hubs, reservation.hubId, { occupiedSlots: -1 }),
  }))

  const findOwned = (studentId: string, reservationId: string) => {
    const reservation = get().parkingReservations.find((item) => item.reservationId === reservationId)
    if (!reservation) return { error: 'NOT_FOUND' as const, reservation: undefined }
    if (reservation.studentId !== studentId) return { error: 'NOT_OWNER' as const, reservation: undefined }
    return { error: undefined, reservation }
  }

  return {
    chargingRequestEvents: initialChargingRequestEvents,

    reserveParking: ({ studentId, hubId, arrivalTime, evId }) => {
      const state = get()
      const hub = state.hubs.find((item) => item.hubId === hubId)
      if (!hub) return { ok: false, reason: 'HUB_NOT_FOUND' }
      if (evId && !state.privateEVs.some((ev) => ev.evId === evId && ev.ownerStudentId === studentId)) return { ok: false, reason: 'EV_NOT_OWNED' }

      const now = Date.now()
      const arrival = new Date(arrivalTime).getTime()
      if (Number.isNaN(arrival) || arrival < now - MINUTE || arrival > now + PARKING_RULES.maxLeadMinutes * MINUTE) {
        return { ok: false, reason: 'INVALID_ARRIVAL_TIME' }
      }
      const duplicate = state.parkingReservations.some((item) => item.studentId === studentId && item.hubId === hubId
        && OPEN_RESERVATION_STATUSES.includes(item.status))
      if (duplicate) return { ok: false, reason: 'DUPLICATE_RESERVATION' }
      if (availableCapacity(hub) <= 0) return { ok: false, reason: 'HUB_FULL' }

      const reservation: ParkingReservation = {
        reservationId: nextCode('PK', state.parkingReservations.map((item) => item.reservationId), now),
        studentId, hubId, evId, status: 'HELD', arrivalTime: new Date(arrival).toISOString(),
        expiresAt: new Date(arrival + PARKING_RULES.capacityGraceMinutes * MINUTE).toISOString(),
        createdAt: new Date(now).toISOString(),
      }
      set((current) => ({
        parkingReservations: [...current.parkingReservations, reservation],
        hubs: updateHub(current.hubs, hubId, { heldSlots: 1 }),
      }))
      return { ok: true, reservationId: reservation.reservationId }
    },

    cancelParkingReservation: (studentId, reservationId) => {
      const { reservation, error } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status !== 'HELD' && reservation.status !== 'SLOT_ASSIGNED') return { ok: false, reason: 'INVALID_STATE' }
      endHeldReservation(reservation, 'CANCELLED')
      return { ok: true }
    },

    checkInParking: (studentId, reservationId) => {
      get().sweepParkingExpiry()
      const { reservation, error } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status === 'EXPIRED') return { ok: false, reason: 'EXPIRED' }
      if (reservation.status !== 'HELD') return { ok: false, reason: 'INVALID_STATE' }

      const now = Date.now()
      const hubSlots = get().parkingSlots.filter((slot) => slot.hubId === reservation.hubId)
      const candidate = hubSlots.filter((slot) => slot.status === 'FREE' && slot.sensorStatus === 'ONLINE')
        .sort((a, b) => a.slotId.localeCompare(b.slotId))[0]

      if (!candidate) {
        const reason: ParkingFailureReason = hubSlots.some((slot) => slot.status === 'FREE') ? 'SENSOR_UNAVAILABLE' : 'NO_PHYSICAL_SLOT'
        endHeldReservation(reservation, 'CHECK_IN_FAILED', { failureReason: reason, checkedInAt: new Date(now).toISOString() })
        get().raiseIncident({
          assetId: reservation.hubId, hubId: reservation.hubId, severity: 'MEDIUM',
          title: reason === 'SENSOR_UNAVAILABLE'
            ? `Check-in thất bại (${reservation.reservationId}): ô trống không có cảm biến hoạt động`
            : `Check-in thất bại (${reservation.reservationId}): không còn ô trống`,
        })
        return { ok: false, reason }
      }

      set((state) => ({
        parkingSlots: updateById(state.parkingSlots, 'slotId', candidate.slotId, { status: 'ASSIGNED', vehicleId: reservation.evId }),
        parkingReservations: updateById(state.parkingReservations, 'reservationId', reservationId, {
          status: 'SLOT_ASSIGNED', slotId: candidate.slotId, checkedInAt: new Date(now).toISOString(),
          slotHoldExpiresAt: new Date(now + PARKING_RULES.slotHoldMinutes * MINUTE).toISOString(),
        }),
      }))
      return { ok: true, slotId: candidate.slotId }
    },

    checkOutParking: (studentId, reservationId) => {
      const { reservation, error } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status !== 'ARRIVED') return { ok: false, reason: 'INVALID_STATE' }
      completeReservation(reservation)
      return { ok: true }
    },

    reportSlotSensor: (slotId, reading) => {
      get().sweepParkingExpiry()
      const state = get()
      const slot = state.parkingSlots.find((item) => item.slotId === slotId)
      if (!slot || slot.sensorStatus !== 'ONLINE' || slot.status === 'UNAVAILABLE') return 'IGNORED'
      const reservation = state.parkingReservations.find((item) => item.slotId === slotId
        && (item.status === 'SLOT_ASSIGNED' || item.status === 'ARRIVED'))

      if (reading === 'OCCUPIED') {
        if (slot.status === 'ASSIGNED' && reservation?.status === 'SLOT_ASSIGNED') {
          set((current) => ({
            parkingSlots: updateById(current.parkingSlots, 'slotId', slotId, { status: 'OCCUPIED' }),
            parkingReservations: updateById(current.parkingReservations, 'reservationId', reservation.reservationId, { status: 'ARRIVED' }),
            hubs: updateHub(current.hubs, reservation.hubId, { heldSlots: -1, occupiedSlots: 1 }),
          }))
          return 'ARRIVED'
        }
        if (slot.status === 'FREE') {
          set((current) => ({
            parkingSlots: updateById(current.parkingSlots, 'slotId', slotId, { status: 'OCCUPIED' }),
            hubs: updateHub(current.hubs, slot.hubId, { occupiedSlots: 1 }),
          }))
          get().raiseIncident({ assetId: slotId, hubId: slot.hubId, severity: 'LOW', title: `Ô ${slotId} có xe đỗ nhưng không có đơn đặt chỗ` })
          return 'UNEXPECTED_OCCUPANCY'
        }
        return 'IGNORED'
      }

      if (slot.status !== 'OCCUPIED') return 'IGNORED'
      if (reservation?.status === 'ARRIVED') {
        completeReservation(reservation)
        return 'COMPLETED'
      }
      set((current) => ({
        parkingSlots: freeSlot(current.parkingSlots, slotId),
        hubs: updateHub(current.hubs, slot.hubId, { occupiedSlots: -1 }),
      }))
      return 'VEHICLE_LEFT'
    },

    setSlotSensorStatus: (slotId, sensorStatus) => {
      const slot = get().parkingSlots.find((item) => item.slotId === slotId)
      if (!slot || slot.sensorStatus === sensorStatus) return
      set((state) => ({ parkingSlots: updateById(state.parkingSlots, 'slotId', slotId, { sensorStatus }) }))
      if (sensorStatus === 'FAULT') {
        get().raiseIncident({ assetId: slotId, hubId: slot.hubId, severity: 'MEDIUM', title: `Cảm biến ô ${slotId} báo lỗi` })
      }
    },

    sweepParkingExpiry: (now = Date.now()) => {
      let handled = 0
      for (const reservation of get().parkingReservations) {
        const expired = now > new Date(reservation.expiresAt).getTime()
        if (reservation.status === 'HELD' && expired) {
          endHeldReservation(reservation, 'EXPIRED')
          handled += 1
        } else if (reservation.status === 'SLOT_ASSIGNED' && reservation.slotHoldExpiresAt && now > new Date(reservation.slotHoldExpiresAt).getTime()) {
          if (expired) {
            endHeldReservation(reservation, 'EXPIRED')
          } else {
            // Sensor never confirmed: give the slot back, keep the capacity hold so the student can check in again
            set((state) => ({
              parkingSlots: freeSlot(state.parkingSlots, reservation.slotId),
              parkingReservations: updateById(state.parkingReservations, 'reservationId', reservation.reservationId, {
                status: 'HELD', slotId: undefined, slotHoldExpiresAt: undefined,
              }),
            }))
          }
          handled += 1
        }
      }
      return handled
    },

    submitPrivateEvChargingRequest: (input) => {
      const state = get()
      const now = Date.now()
      const ev = state.privateEVs.find((item) => item.evId === input.evId)
      if (!ev) return { ok: false, reason: 'EV_NOT_FOUND' }
      if (ev.ownerStudentId !== input.studentId) return { ok: false, reason: 'NOT_OWNER' }
      if (!state.hubs.some((hub) => hub.hubId === input.hubId)) return { ok: false, reason: 'HUB_NOT_FOUND' }

      const start = new Date(input.desiredStart).getTime()
      const end = new Date(input.desiredEnd).getTime()
      if (Number.isNaN(start) || Number.isNaN(end) || start >= end || end <= now) return { ok: false, reason: 'INVALID_WINDOW' }
      if (state.chargingRequests.some((request) => request.vehicleId === ev.evId && ACTIVE_CHARGING_STATUSES.includes(request.status))) {
        return { ok: false, reason: 'DUPLICATE_REQUEST' }
      }

      let battery: number
      let batteryVerified: boolean
      if (ev.battery !== undefined && isTelemetryFresh(ev.lastTelemetryAt, now)) {
        battery = ev.battery
        batteryVerified = true
      } else {
        if (input.manualBattery === undefined || Number.isNaN(input.manualBattery)) return { ok: false, reason: 'BATTERY_REQUIRED' }
        if (!Number.isInteger(input.manualBattery) || input.manualBattery < 0 || input.manualBattery > 100) return { ok: false, reason: 'INVALID_BATTERY' }
        if (!input.manualBatteryConfirmed) return { ok: false, reason: 'BATTERY_NOT_CONFIRMED' }
        battery = input.manualBattery
        batteryVerified = false
      }

      const request: ChargingRequest = {
        requestId: nextCode('CQ', state.chargingRequests.map((item) => item.requestId), now),
        source: 'STUDENT', vehicleId: ev.evId, hubId: input.hubId, battery, batteryVerified,
        status: 'WAITING', createdAt: new Date(now).toISOString(), requesterId: input.studentId,
        desiredStart: new Date(start).toISOString(), desiredEnd: new Date(end).toISOString(),
        nextUseAt: input.nextUseAt ? new Date(input.nextUseAt).toISOString() : undefined,
      }
      set((current) => ({ chargingRequests: [...current.chargingRequests, request] }))
      return { ok: true, requestId: request.requestId }
    },

    cancelChargingRequest: (studentId, requestId) => {
      const request = get().chargingRequests.find((item) => item.requestId === requestId)
      if (!request) return { ok: false, reason: 'NOT_FOUND' }
      if (request.source !== 'STUDENT' || request.requesterId !== studentId) return { ok: false, reason: 'NOT_OWNER' }
      if (!CANCELLABLE_CHARGING_STATUSES.includes(request.status)) return { ok: false, reason: 'INVALID_STATE' }
      set((state) => ({
        chargingRequests: updateById(state.chargingRequests, 'requestId', requestId, { status: 'CANCELLED' }),
        // A scheduled request keeps its point ASSIGNED; give it back so the scheduler can reuse it
        chargingPoints: state.chargingPoints.map((point) => point.chargingPointId === request.chargingPointId
          && point.status === 'ASSIGNED' && point.vehicleId === request.vehicleId
          ? { ...point, status: 'AVAILABLE', vehicleId: undefined } : point),
      }))
      return { ok: true }
    },

    recordChargingRequestChanges: (previous, next) => {
      const events = diffChargingRequests(previous, next, new Date().toISOString())
      if (events.length === 0) return
      set((state) => ({
        chargingRequestEvents: [
          ...state.chargingRequestEvents,
          ...events.map((event, index) => ({ ...event, eventId: `EV-${state.chargingRequestEvents.length + index + 1}` })),
        ],
      }))
    },
  }
}

// Keeps the request history in sync with every change to the queue, whoever made it (Kiệt's scheduler included).
export const watchChargingRequests = (store: {
  subscribe: (listener: (state: MobilityState, previous: MobilityState) => void) => () => void
}) => store.subscribe((state, previous) => {
  if (state.chargingRequests !== previous.chargingRequests) {
    state.recordChargingRequestChanges(previous.chargingRequests, state.chargingRequests)
  }
})
