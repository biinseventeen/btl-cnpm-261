// Shared domain state. Each business area lives in its own slice:
//   parkingSlice        Parking & Private EV (Thịnh)
//   vehicleJourneySlice Vehicle Journey & Reservation (Khải)
//   chargingSlice       Charging queue, charging points, dispatch (Kiệt)
//   operationSlice      Incidents and What-if Simulation (Thịnh)
import { create } from 'zustand'
import { createSeedData, initialSeed } from '../data/mockData'
import type { ChargingPoint, ChargingRequest, DispatchOrder, Hub, ParkingReservation, ParkingSlot, PrivateEV, Vehicle } from '../types'
import { createChargingSlice, type ChargingSlice } from './chargingSlice'
import { createOperationSlice, type OperationSlice } from './operationSlice'
import { createParkingSlice, watchChargingRequests, type ParkingSlice } from './parkingSlice'
import { createVehicleJourneySlice, type VehicleJourneySlice } from './vehicleJourneySlice'

export type { NewIncident } from './operationSlice'

interface CoreState {
  hubs: Hub[]
  vehicles: Vehicle[]
  chargingRequests: ChargingRequest[]
  chargingPoints: ChargingPoint[]
  parkingSlots: ParkingSlot[]
  parkingReservations: ParkingReservation[]
  privateEVs: PrivateEV[]
  dispatchOrders: DispatchOrder[]
  resetDemo: () => void
}

export type MobilityState = CoreState & ParkingSlice & VehicleJourneySlice & ChargingSlice & OperationSlice

export const useMobilityStore = create<MobilityState>()((set, get, api) => ({
  ...createParkingSlice(set, get, api),
  ...createVehicleJourneySlice(set, get, api),
  ...createChargingSlice(set, get, api),
  ...createOperationSlice(set, get, api),
  ...initialSeed,
  resetDemo: () => set(createSeedData()),
}))

watchChargingRequests(useMobilityStore)
