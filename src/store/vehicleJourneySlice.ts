// Vehicle Journey & Reservation actions (logic owner: Khải). First version written by Lợi so the
// UI could be wired end to end; Khải reviews and takes over. Merged into useMobilityStore.
//
// Hub counters: a reserved vehicle still stands in its Hub, pickup frees one space (occupied - 1),
// a successful return takes one space at the destination (occupied + 1).
import type { StateCreator } from 'zustand'
import type { ChargingRequest, Vehicle, VehicleReservation, VehicleReservationStatus, VehicleStatus } from '../types'
import { adjustHub, hubFreeSlots, MINUTE, nextCode, updateById, type Fail } from './storeUtils'
import type { MobilityState } from './useMobilityStore'

export const JOURNEY_RULES = {
  holdMinutes: 15, // a reservation waits 15 minutes for the QR pickup
  minBattery: 20, // battery at or below 20% cannot be reserved and goes to charging on return
  heartbeatTimeoutSeconds: 20, // 2 missed heartbeats of 10 seconds = disconnected
  drainPerMinute: 0.4, // demo battery drain while riding
}

export const OPEN_VEHICLE_RESERVATION: VehicleReservationStatus[] = ['RESERVED', 'IN_USE']

export type ReserveVehicleResult =
  | { ok: true; reservationId: string }
  | Fail<'VEHICLE_NOT_FOUND' | 'ALREADY_RESERVED' | 'VEHICLE_UNAVAILABLE' | 'LOW_BATTERY' | 'ACTIVE_RESERVATION_EXISTS'>

export type JourneyActionResult = { ok: true } | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE'>

export type PickUpResult = { ok: true } | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE' | 'EXPIRED' | 'QR_MISMATCH'>

export type ReturnVehicleResult =
  | { ok: true; outcome: VehicleStatus; chargingRequestId?: string; incidentId?: string }
  | Fail<'NOT_FOUND' | 'NOT_OWNER' | 'INVALID_STATE' | 'HUB_NOT_FOUND' | 'HUB_FULL'>

export interface VehicleTelemetryChange {
  battery?: number
  faultCode?: string | null
  heartbeatLost?: boolean
}

export interface VehicleJourneySlice {
  vehicleReservations: VehicleReservation[]
  reserveSharedVehicle: (studentId: string, vehicleId: string) => ReserveVehicleResult
  cancelVehicleReservation: (studentId: string, reservationId: string) => JourneyActionResult
  pickUpVehicle: (studentId: string, reservationId: string, scannedVehicleId: string) => PickUpResult
  toggleTripLock: (studentId: string, reservationId: string) => JourneyActionResult
  reportTripIssue: (studentId: string, reservationId: string, title: string) => string | undefined
  returnSharedVehicle: (studentId: string, reservationId: string, destinationHubId: string) => ReturnVehicleResult
  sweepVehicleReservations: (now?: number) => number
  // Demo only: plays the role of the vehicle IoT feed
  setVehicleTelemetry: (vehicleId: string, change: VehicleTelemetryChange) => void
  tickVehicleTelemetry: (now?: number) => void
}

export const isHeartbeatFresh = (vehicle: Vehicle, now = Date.now()) =>
  now - new Date(vehicle.lastHeartbeat).getTime() <= JOURNEY_RULES.heartbeatTimeoutSeconds * 1000

// Rough range so the UI can show "~25 km": e-bikes ~0.3 km per %, e-scooters ~0.6 km per %
export const estimatedRangeKm = (vehicle: Pick<Vehicle, 'battery' | 'vehicleType'>) =>
  Math.round(vehicle.battery * (vehicle.vehicleType === 'E_SCOOTER' ? 0.6 : 0.3))

export const isReservable = (vehicle: Vehicle) => vehicle.status === 'AVAILABLE' && vehicle.battery > JOURNEY_RULES.minBattery

export const createVehicleJourneySlice: StateCreator<MobilityState, [], [], VehicleJourneySlice> = (set, get) => {
  const findOwned = (studentId: string, reservationId: string) => {
    const reservation = get().vehicleReservations.find((item) => item.reservationId === reservationId)
    if (!reservation) return { error: 'NOT_FOUND' as const, reservation: undefined }
    if (reservation.studentId !== studentId) return { error: 'NOT_OWNER' as const, reservation: undefined }
    return { error: undefined, reservation }
  }

  let lastTickAt: number | undefined

  return {
    vehicleReservations: [],

    reserveSharedVehicle: (studentId, vehicleId) => {
      get().sweepVehicleReservations()
      const state = get()
      const now = Date.now()
      const vehicle = state.vehicles.find((item) => item.vehicleId === vehicleId)
      if (!vehicle) return { ok: false, reason: 'VEHICLE_NOT_FOUND' }
      if (state.vehicleReservations.some((item) => item.studentId === studentId && OPEN_VEHICLE_RESERVATION.includes(item.status))) {
        return { ok: false, reason: 'ACTIVE_RESERVATION_EXISTS' }
      }
      // Someone else got there first (VJ-03e)
      if (vehicle.status === 'RESERVED') return { ok: false, reason: 'ALREADY_RESERVED' }
      if (vehicle.status !== 'AVAILABLE' || !isHeartbeatFresh(vehicle, now) || vehicle.faultCode) return { ok: false, reason: 'VEHICLE_UNAVAILABLE' }
      if (vehicle.battery <= JOURNEY_RULES.minBattery) return { ok: false, reason: 'LOW_BATTERY' }

      const reservation: VehicleReservation = {
        reservationId: nextCode('VJ', state.vehicleReservations.map((item) => item.reservationId), now),
        studentId, vehicleId, hubId: vehicle.hubId, status: 'RESERVED',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + JOURNEY_RULES.holdMinutes * MINUTE).toISOString(),
      }
      set((current) => ({
        vehicles: updateById(current.vehicles, 'vehicleId', vehicleId, { status: 'RESERVED' }),
        vehicleReservations: [...current.vehicleReservations, reservation],
      }))
      return { ok: true, reservationId: reservation.reservationId }
    },

    cancelVehicleReservation: (studentId, reservationId) => {
      const { error, reservation } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status !== 'RESERVED') return { ok: false, reason: 'INVALID_STATE' }
      set((state) => ({
        vehicleReservations: updateById(state.vehicleReservations, 'reservationId', reservationId, { status: 'CANCELLED' }),
        vehicles: state.vehicles.map((vehicle) => vehicle.vehicleId === reservation.vehicleId && vehicle.status === 'RESERVED'
          ? { ...vehicle, status: 'AVAILABLE' } : vehicle),
      }))
      return { ok: true }
    },

    pickUpVehicle: (studentId, reservationId, scannedVehicleId) => {
      get().sweepVehicleReservations()
      const { error, reservation } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status === 'EXPIRED') return { ok: false, reason: 'EXPIRED' }
      if (reservation.status !== 'RESERVED') return { ok: false, reason: 'INVALID_STATE' }
      if (scannedVehicleId.trim().toUpperCase() !== reservation.vehicleId) return { ok: false, reason: 'QR_MISMATCH' }
      const vehicle = get().vehicles.find((item) => item.vehicleId === reservation.vehicleId)
      const now = new Date().toISOString()
      set((state) => ({
        vehicles: updateById(state.vehicles, 'vehicleId', reservation.vehicleId, { status: 'IN_USE' }),
        vehicleReservations: updateById(state.vehicleReservations, 'reservationId', reservationId, {
          status: 'IN_USE', pickedUpAt: now, startBattery: vehicle?.battery,
        }),
        hubs: adjustHub(state.hubs, reservation.hubId, { occupiedSlots: -1 }),
      }))
      return { ok: true }
    },

    toggleTripLock: (studentId, reservationId) => {
      const { error, reservation } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status !== 'IN_USE') return { ok: false, reason: 'INVALID_STATE' }
      set((state) => ({
        vehicleReservations: updateById(state.vehicleReservations, 'reservationId', reservationId, { locked: !reservation.locked }),
      }))
      return { ok: true }
    },

    reportTripIssue: (studentId, reservationId, title) => {
      const { reservation } = findOwned(studentId, reservationId)
      if (!reservation || reservation.status !== 'IN_USE') return undefined
      return get().raiseIncident({ assetId: reservation.vehicleId, hubId: reservation.hubId, title, severity: 'MEDIUM' })
    },

    returnSharedVehicle: (studentId, reservationId, destinationHubId) => {
      const { error, reservation } = findOwned(studentId, reservationId)
      if (error) return { ok: false, reason: error }
      if (reservation.status !== 'IN_USE') return { ok: false, reason: 'INVALID_STATE' }
      const state = get()
      const hub = state.hubs.find((item) => item.hubId === destinationHubId)
      if (!hub) return { ok: false, reason: 'HUB_NOT_FOUND' }
      // Validate before touching anything: a failed return leaves the trip open (VJ-05)
      if (hubFreeSlots(hub) <= 0) return { ok: false, reason: 'HUB_FULL' }
      const vehicle = state.vehicles.find((item) => item.vehicleId === reservation.vehicleId)
      if (!vehicle) return { ok: false, reason: 'NOT_FOUND' }

      const now = Date.now()
      // Condition priority: stale heartbeat > fault > low battery > available
      let outcome: VehicleStatus = 'AVAILABLE'
      let incidentTitle: string | undefined
      if (!isHeartbeatFresh(vehicle, now)) {
        outcome = 'DISCONNECTED'
        incidentTitle = 'Mất heartbeat khi trả xe'
      } else if (vehicle.faultCode) {
        outcome = 'UNAVAILABLE'
        incidentTitle = `Xe báo lỗi ${vehicle.faultCode} khi trả`
      } else if (vehicle.battery <= JOURNEY_RULES.minBattery) {
        outcome = 'PENDING_CHARGING'
      }

      const openRequest = state.chargingRequests.some((request) => request.vehicleId === vehicle.vehicleId
        && ['NEEDS_VERIFICATION', 'WAITING', 'SCHEDULED', 'CHARGING'].includes(request.status))
      let chargingRequestId: string | undefined
      const newRequests: ChargingRequest[] = []
      if (outcome === 'PENDING_CHARGING' && !openRequest) {
        chargingRequestId = nextCode('CR', state.chargingRequests.map((item) => item.requestId), now)
        newRequests.push({
          requestId: chargingRequestId, source: 'SYSTEM', vehicleId: vehicle.vehicleId, hubId: destinationHubId,
          battery: vehicle.battery, batteryVerified: true, status: 'WAITING', createdAt: new Date(now).toISOString(),
        })
      }

      set((current) => ({
        vehicles: updateById(current.vehicles, 'vehicleId', vehicle.vehicleId, { hubId: destinationHubId, status: outcome }),
        vehicleReservations: updateById(current.vehicleReservations, 'reservationId', reservationId, {
          status: 'COMPLETED', returnedAt: new Date(now).toISOString(), returnHubId: destinationHubId, returnOutcome: outcome, locked: false,
        }),
        hubs: adjustHub(current.hubs, destinationHubId, { occupiedSlots: 1 }),
        chargingRequests: [...current.chargingRequests, ...newRequests],
      }))
      const incidentId = incidentTitle
        ? get().raiseIncident({ assetId: vehicle.vehicleId, hubId: destinationHubId, title: incidentTitle, severity: outcome === 'UNAVAILABLE' ? 'HIGH' : 'MEDIUM', faultCode: vehicle.faultCode ?? 'HB-TIMEOUT' })
        : undefined
      return { ok: true, outcome, chargingRequestId, incidentId }
    },

    sweepVehicleReservations: (now = Date.now()) => {
      const expired = get().vehicleReservations.filter((item) => item.status === 'RESERVED' && now > new Date(item.expiresAt).getTime())
      if (expired.length === 0) return 0
      const ids = new Set(expired.map((item) => item.reservationId))
      const vehicleIds = new Set(expired.map((item) => item.vehicleId))
      set((state) => ({
        vehicleReservations: state.vehicleReservations.map((item) => ids.has(item.reservationId) ? { ...item, status: 'EXPIRED' } : item),
        vehicles: state.vehicles.map((vehicle) => vehicleIds.has(vehicle.vehicleId) && vehicle.status === 'RESERVED'
          ? { ...vehicle, status: 'AVAILABLE' } : vehicle),
      }))
      return expired.length
    },

    setVehicleTelemetry: (vehicleId, change) => set((state) => ({
      vehicles: state.vehicles.map((vehicle) => vehicle.vehicleId !== vehicleId ? vehicle : {
        ...vehicle,
        battery: change.battery ?? vehicle.battery,
        faultCode: change.faultCode === null ? undefined : change.faultCode ?? vehicle.faultCode,
        lastHeartbeat: change.heartbeatLost === undefined ? vehicle.lastHeartbeat
          : new Date(Date.now() - (change.heartbeatLost ? 5 * MINUTE : 0)).toISOString(),
      }),
    })),

    // Simulated IoT feed: connected vehicles keep sending heartbeats, riding drains the battery.
    // A heartbeat older than 3 minutes (plus the gap since the previous tick, so a sleeping laptop
    // does not knock every vehicle offline) counts as lost on purpose and is not refreshed.
    tickVehicleTelemetry: (now = Date.now()) => {
      const gap = Math.max(0, now - (lastTickAt ?? now))
      lastTickAt = now
      const trips = new Map(get().vehicleReservations.filter((item) => item.status === 'IN_USE' && item.pickedUpAt)
        .map((item) => [item.vehicleId, item]))
      let changed = false
      const vehicles = get().vehicles.map((vehicle) => {
        const age = now - new Date(vehicle.lastHeartbeat).getTime()
        const alive = vehicle.status !== 'DISCONNECTED' && age < 3 * MINUTE + gap
        const trip = trips.get(vehicle.vehicleId)
        const drained = trip?.startBattery !== undefined
          ? Math.max(0, Math.round(trip.startBattery - ((now - new Date(trip.pickedUpAt!).getTime()) / MINUTE) * JOURNEY_RULES.drainPerMinute))
          : vehicle.battery
        const battery = Math.min(vehicle.battery, drained)
        if (!alive && battery === vehicle.battery) return vehicle
        changed = true
        return { ...vehicle, battery, lastHeartbeat: alive ? new Date(now).toISOString() : vehicle.lastHeartbeat }
      })
      if (changed) set({ vehicles })
    },
  }
}
