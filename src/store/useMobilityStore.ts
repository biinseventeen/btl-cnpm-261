import { create } from 'zustand'
import {
  initialChargingPoints, initialChargingRequests, initialHubs, initialIncidents,
  initialParkingReservations, initialParkingSlots, initialSimulationPreview, initialVehicles,
} from '../data/mockData'
import type {
  ChargingPoint, ChargingRequest, DispatchOrder, Hub, OperationalIncident,
  ParkingReservation, ParkingSlot, SimulationPreview, Vehicle,
} from '../types'

interface MobilityState {
  hubs: Hub[]
  vehicles: Vehicle[]
  chargingRequests: ChargingRequest[]
  chargingPoints: ChargingPoint[]
  parkingSlots: ParkingSlot[]
  parkingReservations: ParkingReservation[]
  incidents: OperationalIncident[]
  dispatchOrders: DispatchOrder[]
  simulationPreview: SimulationPreview
  reserveVehicle: (vehicleId: string) => void
  returnVehicle: (vehicleId: string, destinationHubId: string, battery: number) => void
  scheduleChargingRequest: (requestId: string, chargingPointId: string) => void
  createParkingReservation: (studentId: string, hubId: string) => void
  applySimulationRecommendation: () => 'APPLIED' | 'STALE' | 'INVALID'
  resolveIncident: (incidentId: string) => void
}

export const useMobilityStore = create<MobilityState>((set, get) => ({
  hubs: initialHubs,
  vehicles: initialVehicles,
  chargingRequests: initialChargingRequests,
  chargingPoints: initialChargingPoints,
  parkingSlots: initialParkingSlots,
  parkingReservations: initialParkingReservations,
  incidents: initialIncidents,
  dispatchOrders: [],
  simulationPreview: initialSimulationPreview,

  reserveVehicle: (vehicleId) => set((state) => ({
    vehicles: state.vehicles.map((vehicle) => vehicle.vehicleId === vehicleId && vehicle.status === 'AVAILABLE'
      ? { ...vehicle, status: 'RESERVED' } : vehicle),
  })),

  returnVehicle: (vehicleId, destinationHubId, battery) => set((state) => {
    const targetHub = state.hubs.find((hub) => hub.hubId === destinationHubId)
    const vehicle = state.vehicles.find((item) => item.vehicleId === vehicleId)
    if (!targetHub || !vehicle || targetHub.occupiedSlots + targetHub.heldSlots + targetHub.incomingReserved >= targetHub.totalSlots) return state

    const lowBattery = battery <= 20
    const requestExists = state.chargingRequests.some((request) => request.vehicleId === vehicleId && ['WAITING', 'SCHEDULED', 'CHARGING'].includes(request.status))
    const newRequest: ChargingRequest = {
      requestId: `CR-${String(state.chargingRequests.length + 1).padStart(3, '0')}`,
      source: 'SYSTEM', vehicleId, hubId: destinationHubId, battery,
      status: 'WAITING', createdAt: new Date().toISOString(),
    }
    return {
      vehicles: state.vehicles.map((item) => item.vehicleId === vehicleId
        ? { ...item, hubId: destinationHubId, battery, status: lowBattery ? 'PENDING_CHARGING' : 'AVAILABLE' } : item),
      hubs: state.hubs.map((hub) => hub.hubId === destinationHubId ? { ...hub, occupiedSlots: hub.occupiedSlots + 1 } : hub),
      chargingRequests: lowBattery && !requestExists ? [...state.chargingRequests, newRequest] : state.chargingRequests,
    }
  }),

  scheduleChargingRequest: (requestId, chargingPointId) => set((state) => {
    const point = state.chargingPoints.find((item) => item.chargingPointId === chargingPointId)
    const request = state.chargingRequests.find((item) => item.requestId === requestId)
    if (!point || point.status !== 'AVAILABLE' || !request || request.status !== 'WAITING') return state
    return {
      chargingPoints: state.chargingPoints.map((item) => item.chargingPointId === chargingPointId
        ? { ...item, status: 'ASSIGNED', vehicleId: request.vehicleId } : item),
      chargingRequests: state.chargingRequests.map((item) => item.requestId === requestId
        ? { ...item, status: 'SCHEDULED', chargingPointId } : item),
    }
  }),

  createParkingReservation: (studentId, hubId) => set((state) => {
    const hub = state.hubs.find((item) => item.hubId === hubId)
    if (!hub || hub.occupiedSlots + hub.heldSlots + hub.incomingReserved >= hub.totalSlots) return state
    const reservation: ParkingReservation = {
      reservationId: `PR-${String(state.parkingReservations.length + 1).padStart(3, '0')}`,
      studentId, hubId, status: 'HELD', arrivalTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }
    return {
      parkingReservations: [...state.parkingReservations, reservation],
      hubs: state.hubs.map((item) => item.hubId === hubId ? { ...item, heldSlots: item.heldSlots + 1 } : item),
    }
  }),

  applySimulationRecommendation: () => {
    const state = get()
    const preview = state.simulationPreview
    const liveAvailable = state.vehicles.filter((vehicle) => vehicle.hubId === preview.sourceHubId && vehicle.status === 'AVAILABLE').length
    if (preview.status !== 'READY' || liveAvailable < preview.vehicleIds.length) {
      set({ simulationPreview: { ...preview, status: 'STALE' } })
      return 'STALE'
    }
    const ids = new Set(preview.vehicleIds)
    const order: DispatchOrder = {
      orderId: `DO-${String(state.dispatchOrders.length + 1).padStart(3, '0')}`,
      sourceHubId: preview.sourceHubId, destinationHubId: preview.destinationHubId,
      vehicleIds: preview.vehicleIds, status: 'IN_PROGRESS',
    }
    set((current) => ({
      vehicles: current.vehicles.map((vehicle) => ids.has(vehicle.vehicleId) ? { ...vehicle, status: 'IN_TRANSIT' } : vehicle),
      dispatchOrders: [...current.dispatchOrders, order],
      simulationPreview: { ...current.simulationPreview, status: 'APPLIED' },
    }))
    return 'APPLIED'
  },

  resolveIncident: (incidentId) => set((state) => ({
    incidents: state.incidents.map((incident) => incident.incidentId === incidentId
      ? { ...incident, status: 'RESOLVED' } : incident),
  })),
}))
