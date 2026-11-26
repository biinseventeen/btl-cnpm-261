import { create } from 'zustand'
import {
  createSeedData, initialChargingPoints, initialChargingRequests, initialHubs, initialIncidents,
  initialParkingReservations, initialParkingSlots, initialPrivateEVs, initialSimulationPreview, initialVehicles,
} from '../data/mockData'
import type {
  ChargingPoint, ChargingRequest, DispatchOrder, Hub, OperationalIncident,
  ParkingReservation, ParkingSlot, PrivateEV, SimulationPreview, Vehicle,
} from '../types'
import { createParkingSlice, watchChargingRequests, type ParkingSlice } from './parkingSlice'

export type NewIncident = Pick<OperationalIncident, 'assetId' | 'hubId' | 'title' | 'severity'>

interface CoreState {
  hubs: Hub[]
  vehicles: Vehicle[]
  chargingRequests: ChargingRequest[]
  chargingPoints: ChargingPoint[]
  parkingSlots: ParkingSlot[]
  parkingReservations: ParkingReservation[]
  privateEVs: PrivateEV[]
  incidents: OperationalIncident[]
  dispatchOrders: DispatchOrder[]
  simulationPreview: SimulationPreview
  reserveVehicle: (vehicleId: string) => void
  returnVehicle: (vehicleId: string, destinationHubId: string, battery: number) => void
  scheduleChargingRequest: (requestId: string, chargingPointId: string) => void
  applySimulationRecommendation: () => 'APPLIED' | 'STALE' | 'INVALID'
  resolveIncident: (incidentId: string) => void
  raiseIncident: (incident: NewIncident) => string
  resetDemo: () => void
}

export type MobilityState = CoreState & ParkingSlice

export const useMobilityStore = create<MobilityState>()((set, get, api) => ({
  ...createParkingSlice(set, get, api),
  hubs: initialHubs,
  vehicles: initialVehicles,
  chargingRequests: initialChargingRequests,
  chargingPoints: initialChargingPoints,
  parkingSlots: initialParkingSlots,
  parkingReservations: initialParkingReservations,
  privateEVs: initialPrivateEVs,
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

  raiseIncident: (incident) => {
    const incidentId = `INC-${String(get().incidents.length + 1).padStart(3, '0')}`
    set((state) => ({
      incidents: [...state.incidents, { ...incident, incidentId, status: 'OPEN', createdAt: new Date().toISOString() }],
    }))
    return incidentId
  },

  resetDemo: () => set({ ...createSeedData(), dispatchOrders: [] }),
}))

watchChargingRequests(useMobilityStore)
