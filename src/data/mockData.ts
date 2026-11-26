import type {
  ChargingPoint, ChargingRequest, Hub, OperationalIncident,
  ParkingReservation, ParkingSlot, SimulationPreview, Vehicle,
} from '../types'

export const initialHubs: Hub[] = [
  { hubId: 'H1', name: 'Ký túc xá Khu A', address: 'ĐHQG-HCM', totalSlots: 20, occupiedSlots: 12, heldSlots: 1, incomingReserved: 0 },
  { hubId: 'H2', name: 'Ga Metro ĐHQG', address: 'ĐHQG-HCM', totalSlots: 20, occupiedSlots: 16, heldSlots: 0, incomingReserved: 0 },
  { hubId: 'H3', name: 'Ký túc xá Khu B', address: 'ĐHQG-HCM', totalSlots: 16, occupiedSlots: 7, heldSlots: 0, incomingReserved: 1 },
]

export const initialVehicles: Vehicle[] = [
  { vehicleId: 'SM-001', hubId: 'H1', battery: 80, status: 'AVAILABLE', lastHeartbeat: new Date().toISOString() },
  { vehicleId: 'SM-002', hubId: 'H1', battery: 15, status: 'PENDING_CHARGING', lastHeartbeat: new Date().toISOString() },
  { vehicleId: 'SM-003', hubId: 'H1', battery: 62, status: 'RESERVED', lastHeartbeat: new Date().toISOString() },
  { vehicleId: 'SM-004', hubId: 'H2', battery: 45, status: 'AVAILABLE', lastHeartbeat: new Date().toISOString() },
  { vehicleId: 'SM-005', hubId: 'H2', battery: 22, status: 'IN_USE', lastHeartbeat: new Date().toISOString() },
  { vehicleId: 'SM-006', hubId: 'H3', battery: 91, status: 'AVAILABLE', lastHeartbeat: new Date().toISOString() },
]

export const initialChargingRequests: ChargingRequest[] = [
  { requestId: 'CR-001', source: 'SYSTEM', vehicleId: 'SM-002', hubId: 'H1', battery: 15, status: 'WAITING', createdAt: new Date().toISOString() },
]

export const initialChargingPoints: ChargingPoint[] = [
  { chargingPointId: 'CP-H1-01', hubId: 'H1', status: 'AVAILABLE', powerKw: 7.4 },
  { chargingPointId: 'CP-H1-02', hubId: 'H1', status: 'CHARGING', powerKw: 7.4, vehicleId: 'SM-002' },
  { chargingPointId: 'CP-H2-01', hubId: 'H2', status: 'AVAILABLE', powerKw: 11 },
  { chargingPointId: 'CP-H3-01', hubId: 'H3', status: 'ERROR', powerKw: 7.4 },
]

export const initialParkingSlots: ParkingSlot[] = [
  { slotId: 'A-12', hubId: 'H1', status: 'FREE' },
  { slotId: 'A-13', hubId: 'H1', status: 'OCCUPIED', vehicleId: 'EV-01' },
  { slotId: 'B-07', hubId: 'H2', status: 'FREE' },
  { slotId: 'C-02', hubId: 'H3', status: 'ASSIGNED', vehicleId: 'EV-02' },
]

export const initialParkingReservations: ParkingReservation[] = [
  { reservationId: 'PR-001', studentId: 'S-03', hubId: 'H1', status: 'HELD', arrivalTime: '2026-11-26T09:00:00+07:00' },
]

export const initialIncidents: OperationalIncident[] = [
  { incidentId: 'INC-001', assetId: 'CP-H3-01', hubId: 'H3', title: 'Charging point communication error', severity: 'HIGH', status: 'OPEN', createdAt: new Date().toISOString() },
]

export const initialSimulationPreview: SimulationPreview = {
  previewId: 'PV-001', sourceHubId: 'H1', destinationHubId: 'H2',
  vehicleIds: ['SM-001', 'SM-006'], generatedAt: new Date().toISOString(),
  sourceAvailableCountAtPreview: 2, status: 'READY',
}
