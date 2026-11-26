import type {
  ChargingPoint, ChargingRequest, ChargingRequestEvent, Hub, OperationalIncident,
  ParkingReservation, ParkingSlot, PrivateEV, SimulationPreview, Vehicle,
} from '../types'

// Times are relative to "now" so expiry timers stay valid after every reset.
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString()

// Parking slot map of H1 zone A, matching the Figma check-in screen (PK-01e).
const h1SlotStates: Record<string, Pick<ParkingSlot, 'status' | 'sensorStatus'>> = {
  'A-03': { status: 'FREE', sensorStatus: 'STALE' },
  'A-06': { status: 'UNAVAILABLE', sensorStatus: 'FAULT' },
  'A-12': { status: 'FREE', sensorStatus: 'ONLINE' },
  'A-14': { status: 'FREE', sensorStatus: 'ONLINE' },
}

export const createSeedData = () => {
  const now = new Date().toISOString()

  const hubs: Hub[] = [
    { hubId: 'H1', name: 'Ký túc xá Khu A', address: 'ĐHQG-HCM', totalSlots: 20, occupiedSlots: 12, heldSlots: 1, incomingReserved: 0 },
    { hubId: 'H2', name: 'Ga Metro ĐHQG', address: 'ĐHQG-HCM', totalSlots: 20, occupiedSlots: 16, heldSlots: 0, incomingReserved: 0 },
    // H3 is full on purpose to demo the "Hub full" exception
    { hubId: 'H3', name: 'Ký túc xá Khu B', address: 'ĐHQG-HCM', totalSlots: 16, occupiedSlots: 15, heldSlots: 0, incomingReserved: 1 },
  ]

  const vehicles: Vehicle[] = [
    { vehicleId: 'SM-001', hubId: 'H1', battery: 80, status: 'AVAILABLE', lastHeartbeat: now },
    { vehicleId: 'SM-002', hubId: 'H1', battery: 15, status: 'PENDING_CHARGING', lastHeartbeat: now },
    { vehicleId: 'SM-003', hubId: 'H1', battery: 62, status: 'RESERVED', lastHeartbeat: now },
    { vehicleId: 'SM-004', hubId: 'H2', battery: 45, status: 'AVAILABLE', lastHeartbeat: now },
    { vehicleId: 'SM-005', hubId: 'H2', battery: 22, status: 'IN_USE', lastHeartbeat: now },
    { vehicleId: 'SM-006', hubId: 'H3', battery: 91, status: 'AVAILABLE', lastHeartbeat: now },
  ]

  const chargingRequests: ChargingRequest[] = [
    { requestId: 'CR-001', source: 'SYSTEM', vehicleId: 'SM-002', hubId: 'H1', battery: 15, status: 'WAITING', createdAt: now },
  ]

  const chargingPoints: ChargingPoint[] = [
    { chargingPointId: 'CP-H1-01', hubId: 'H1', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H1-02', hubId: 'H1', status: 'CHARGING', powerKw: 7.4, vehicleId: 'SM-002' },
    { chargingPointId: 'CP-H2-01', hubId: 'H2', status: 'AVAILABLE', powerKw: 11 },
    { chargingPointId: 'CP-H3-01', hubId: 'H3', status: 'ERROR', powerKw: 7.4 },
  ]

  const parkingSlots: ParkingSlot[] = [
    ...Array.from({ length: 16 }, (_, index): ParkingSlot => {
      const slotId = `A-${String(index + 1).padStart(2, '0')}`
      return { slotId, hubId: 'H1', ...(h1SlotStates[slotId] ?? { status: 'OCCUPIED', sensorStatus: 'ONLINE' }) }
    }),
    { slotId: 'B-07', hubId: 'H2', status: 'FREE', sensorStatus: 'ONLINE' },
    { slotId: 'C-02', hubId: 'H3', status: 'OCCUPIED', sensorStatus: 'ONLINE', vehicleId: 'EV-02' },
  ]

  const parkingReservations: ParkingReservation[] = [
    { reservationId: 'PR-001', studentId: 'S-03', hubId: 'H1', status: 'HELD', arrivalTime: minutesFromNow(60), expiresAt: minutesFromNow(75), createdAt: now },
  ]

  const privateEVs: PrivateEV[] = [
    // No telemetry: the student enters the battery manually (Figma PK-02)
    { evId: 'PE-018', ownerStudentId: 'S-02', plateNumber: '59-X3 018.18', model: 'Xe máy điện · 48 V / 20 Ah' },
    { evId: 'PE-021', ownerStudentId: 'S-02', plateNumber: '59-X3 021.21', model: 'Xe máy điện · 60 V / 30 Ah', battery: 35, lastTelemetryAt: now },
  ]

  const incidents: OperationalIncident[] = [
    { incidentId: 'INC-001', assetId: 'CP-H3-01', hubId: 'H3', title: 'Charging point communication error', severity: 'HIGH', status: 'OPEN', createdAt: now },
  ]

  const simulationPreview: SimulationPreview = {
    previewId: 'PV-001', sourceHubId: 'H1', destinationHubId: 'H2',
    vehicleIds: ['SM-001', 'SM-006'], generatedAt: now,
    sourceAvailableCountAtPreview: 2, status: 'READY',
  }

  const chargingRequestEvents: ChargingRequestEvent[] = []

  return { hubs, vehicles, chargingRequests, chargingPoints, parkingSlots, parkingReservations, privateEVs, chargingRequestEvents, incidents, simulationPreview }
}

const seed = createSeedData()
export const initialHubs = seed.hubs
export const initialVehicles = seed.vehicles
export const initialChargingRequests = seed.chargingRequests
export const initialChargingPoints = seed.chargingPoints
export const initialParkingSlots = seed.parkingSlots
export const initialParkingReservations = seed.parkingReservations
export const initialPrivateEVs = seed.privateEVs
export const initialChargingRequestEvents = seed.chargingRequestEvents
export const initialIncidents = seed.incidents
export const initialSimulationPreview = seed.simulationPreview
