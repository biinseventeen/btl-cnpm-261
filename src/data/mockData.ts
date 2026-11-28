import type {
  ChargingPoint, ChargingQueueAdjustment, ChargingRequest, ChargingRequestEvent, DispatchOrder, Hub,
  OperationalIncident, ParkingReservation, ParkingSlot, PrivateEV, Vehicle, VehicleReservation, VehicleStatus, VehicleType,
} from '../types'

// Times are relative to "now" so expiry timers stay valid after every reset.
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60 * 1000).toISOString()
const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()

// Parking slot map of H1 zone A, matching the Figma check-in screen (PK-01e).
const h1SlotStates: Record<string, Pick<ParkingSlot, 'status' | 'sensorStatus'>> = {
  'A-03': { status: 'FREE', sensorStatus: 'STALE' },
  'A-06': { status: 'UNAVAILABLE', sensorStatus: 'FAULT' },
  'A-12': { status: 'FREE', sensorStatus: 'ONLINE' },
  'A-14': { status: 'FREE', sensorStatus: 'ONLINE' },
}

interface HubPlan {
  hub: Omit<Hub, 'occupiedSlots' | 'heldSlots' | 'incomingReserved'>
  vehicles: number
  // Extra parked spaces besides shared vehicles (occupied private EV slots)
  privateParked: number
  heldSlots: number
  incomingReserved: number
}

// occupiedSlots = shared vehicles parked at the Hub + occupied private parking slots.
// H2 sits above the 85% alert threshold, H3 is full on purpose (Hub full exceptions).
const hubPlans: HubPlan[] = [
  { hub: { hubId: 'H1', name: 'Ký túc xá Khu A', address: 'Đường Tạ Quang Bửu, ĐHQG-HCM', totalSlots: 40 }, vehicles: 14, privateParked: 12, heldSlots: 1, incomingReserved: 0 },
  { hub: { hubId: 'H2', name: 'Ga Metro ĐHQG', address: 'Ga Bến Xe Suối Tiên, Thủ Đức', totalSlots: 30 }, vehicles: 26, privateParked: 0, heldSlots: 0, incomingReserved: 0 },
  { hub: { hubId: 'H3', name: 'Ký túc xá Khu B', address: 'Đường Nguyễn Du, ĐHQG-HCM', totalSlots: 15 }, vehicles: 13, privateParked: 1, heldSlots: 0, incomingReserved: 1 },
  { hub: { hubId: 'H4', name: 'Thư viện Trung tâm', address: 'Khu phố 6, Linh Trung', totalSlots: 24 }, vehicles: 10, privateParked: 0, heldSlots: 0, incomingReserved: 0 },
  { hub: { hubId: 'H5', name: 'ĐH Khoa học Tự nhiên', address: 'Cơ sở Linh Trung', totalSlots: 30 }, vehicles: 8, privateParked: 0, heldSlots: 0, incomingReserved: 0 },
]

// Vehicles with a scripted state; the rest of each Hub is filled with AVAILABLE vehicles.
// IDs follow the fill order: H2 SM-001..026, H1 SM-027..040, H3 SM-041..053, H4 SM-054..063, H5 SM-064..071.
// SM-063 is on another student's trip, so it is not parked at H4.
interface VehicleOverride { status: VehicleStatus; battery: number; type?: VehicleType; faultCode?: string; heartbeatAgo?: number }
const vehicleOverrides: Record<string, VehicleOverride> = {
  'SM-001': { status: 'AVAILABLE', battery: 85, type: 'E_BIKE' },
  'SM-004': { status: 'AVAILABLE', battery: 72, type: 'E_SCOOTER' },
  'SM-007': { status: 'AVAILABLE', battery: 64, type: 'E_BIKE' },
  'SM-011': { status: 'PENDING_CHARGING', battery: 18, type: 'E_SCOOTER' },
  'SM-019': { status: 'PENDING_CHARGING', battery: 12, type: 'E_SCOOTER' },
  'SM-021': { status: 'PENDING_CHARGING', battery: 41, type: 'E_SCOOTER' },
  'SM-024': { status: 'RESERVED', battery: 61, type: 'E_BIKE' },
  'SM-031': { status: 'UNAVAILABLE', battery: 47, type: 'E_SCOOTER', faultCode: 'ERR-BAT-04' },
  'SM-033': { status: 'PENDING_CHARGING', battery: 15, type: 'E_BIKE' },
  'SM-036': { status: 'PENDING_CHARGING', battery: 48, type: 'E_BIKE' },
  'SM-042': { status: 'PENDING_CHARGING', battery: 19, type: 'E_SCOOTER' },
  'SM-048': { status: 'PENDING_CHARGING', battery: 55, type: 'E_SCOOTER' },
  'SM-050': { status: 'DISCONNECTED', battery: 52, type: 'E_BIKE', heartbeatAgo: 240 },
  'SM-063': { status: 'IN_USE', battery: 66, type: 'E_SCOOTER' },
}

// Deterministic battery spread for the filler vehicles (45%–98%)
const fillerBattery = (index: number) => 45 + ((index * 37) % 54)

const buildVehicles = (): Vehicle[] => {
  const vehicles: Vehicle[] = []
  let counter = 0
  // Ga Metro first so SM-001 matches the Figma vehicle journey (picked up at Ga Metro ĐHQG)
  for (const hubId of ['H2', 'H1', 'H3', 'H4', 'H5']) {
    const plan = hubPlans.find((item) => item.hub.hubId === hubId)!
    for (let index = 0; index < plan.vehicles; index += 1) {
      counter += 1
      const vehicleId = `SM-${String(counter).padStart(3, '0')}`
      const override = vehicleOverrides[vehicleId]
      vehicles.push({
        vehicleId, hubId,
        battery: override?.battery ?? fillerBattery(counter),
        status: override?.status ?? 'AVAILABLE',
        vehicleType: override?.type ?? (counter % 3 === 0 ? 'E_SCOOTER' : 'E_BIKE'),
        lastHeartbeat: secondsAgo(override?.heartbeatAgo ?? 3),
        faultCode: override?.faultCode,
      })
    }
  }
  return vehicles
}

export const createSeedData = () => {
  const now = new Date().toISOString()
  const vehicles = buildVehicles()

  const parkedAt = (hubId: string) => vehicles.filter((vehicle) => vehicle.hubId === hubId && vehicle.status !== 'IN_USE' && vehicle.status !== 'IN_TRANSIT').length
  const hubs: Hub[] = hubPlans.map((plan) => ({
    ...plan.hub,
    occupiedSlots: parkedAt(plan.hub.hubId) + plan.privateParked,
    heldSlots: plan.heldSlots,
    incomingReserved: plan.incomingReserved,
  }))

  const chargingPoints: ChargingPoint[] = [
    { chargingPointId: 'CP-H1-01', hubId: 'H1', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H1-02', hubId: 'H1', status: 'CHARGING', powerKw: 7.4, vehicleId: 'SM-036' },
    { chargingPointId: 'CP-H1-03', hubId: 'H1', status: 'AVAILABLE', powerKw: 11 },
    { chargingPointId: 'CP-H2-01', hubId: 'H2', status: 'AVAILABLE', powerKw: 11 },
    { chargingPointId: 'CP-H2-02', hubId: 'H2', status: 'CHARGING', powerKw: 11, vehicleId: 'SM-021' },
    { chargingPointId: 'CP-H2-03', hubId: 'H2', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H2-04', hubId: 'H2', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H3-01', hubId: 'H3', status: 'ERROR', powerKw: 7.4 },
    { chargingPointId: 'CP-H3-02', hubId: 'H3', status: 'CHARGING', powerKw: 7.4, vehicleId: 'SM-048' },
    { chargingPointId: 'CP-H4-01', hubId: 'H4', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H4-02', hubId: 'H4', status: 'AVAILABLE', powerKw: 11 },
    { chargingPointId: 'CP-H5-01', hubId: 'H5', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H5-02', hubId: 'H5', status: 'AVAILABLE', powerKw: 7.4 },
    { chargingPointId: 'CP-H5-03', hubId: 'H5', status: 'AVAILABLE', powerKw: 11 },
  ]

  const vehicleHub = (vehicleId: string) => vehicles.find((vehicle) => vehicle.vehicleId === vehicleId)!.hubId
  const vehicleBattery = (vehicleId: string) => vehicles.find((vehicle) => vehicle.vehicleId === vehicleId)!.battery
  const systemRequest = (requestId: string, vehicleId: string, waitedMinutes: number, extra: Partial<ChargingRequest> = {}): ChargingRequest => ({
    requestId, source: 'SYSTEM', vehicleId, hubId: vehicleHub(vehicleId), battery: vehicleBattery(vehicleId),
    status: 'WAITING', createdAt: minutesFromNow(-waitedMinutes), batteryVerified: true, ...extra,
  })
  const chargingRequests: ChargingRequest[] = [
    systemRequest('CR-001', 'SM-019', 21),
    systemRequest('CR-002', 'SM-036', 55, { status: 'CHARGING', chargingPointId: 'CP-H1-02', scheduledStart: minutesFromNow(-40) }),
    systemRequest('CR-003', 'SM-011', 16),
    systemRequest('CR-004', 'SM-033', 12),
    systemRequest('CR-005', 'SM-042', 9),
    systemRequest('CR-006', 'SM-021', 48, { status: 'CHARGING', chargingPointId: 'CP-H2-02', scheduledStart: minutesFromNow(-30) }),
    systemRequest('CR-007', 'SM-048', 60, { status: 'CHARGING', chargingPointId: 'CP-H3-02', scheduledStart: minutesFromNow(-45) }),
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

  // SM-024 is held by another student, SM-063 is on another student's trip
  const vehicleReservations: VehicleReservation[] = [
    { reservationId: 'VJ-S07-HOLD', studentId: 'S-07', vehicleId: 'SM-024', hubId: 'H2', status: 'RESERVED', createdAt: minutesFromNow(-4), expiresAt: minutesFromNow(11) },
    { reservationId: 'VJ-S09-TRIP', studentId: 'S-09', vehicleId: 'SM-063', hubId: 'H4', status: 'IN_USE', createdAt: minutesFromNow(-30), expiresAt: minutesFromNow(-15), pickedUpAt: minutesFromNow(-22), startBattery: 75 },
  ]

  const incidents: OperationalIncident[] = [
    { incidentId: 'INC-001', assetId: 'CP-H3-01', hubId: 'H3', title: 'Cổng sạc mất kết nối', severity: 'HIGH', status: 'OPEN', createdAt: minutesFromNow(-34), faultCode: 'ERR-CP-COMM', history: [{ at: minutesFromNow(-34), action: 'Hệ thống ghi nhận lỗi kết nối cổng sạc' }] },
    { incidentId: 'INC-002', assetId: 'SM-031', hubId: 'H1', title: 'Tụt pin bất thường', severity: 'HIGH', status: 'IN_PROGRESS', createdAt: minutesFromNow(-12), faultCode: 'ERR-BAT-04', technicianNotifiedAt: minutesFromNow(-10), history: [{ at: minutesFromNow(-12), action: 'Phát hiện mức pin giảm bất thường so với chu kỳ trước' }, { at: minutesFromNow(-10), action: 'Đã gửi thông báo đội kỹ thuật' }, { at: minutesFromNow(-6), action: 'Operator xác nhận đang xử lý' }] },
    { incidentId: 'INC-003', assetId: 'SM-050', hubId: 'H3', title: 'Mất heartbeat ≥ 2 chu kỳ', severity: 'MEDIUM', status: 'OPEN', createdAt: minutesFromNow(-4), faultCode: 'HB-TIMEOUT', history: [{ at: minutesFromNow(-4), action: 'Không nhận heartbeat 2 chu kỳ liên tiếp' }] },
    { incidentId: 'INC-004', assetId: 'SM-012', hubId: 'H2', title: 'Khóa xe thất bại', severity: 'MEDIUM', status: 'RESOLVED', createdAt: minutesFromNow(-95), resolvedAt: minutesFromNow(-70), faultCode: 'ERR-LOCK-02', history: [{ at: minutesFromNow(-95), action: 'Sinh viên báo khóa xe thất bại' }, { at: minutesFromNow(-70), action: 'Đội kỹ thuật xác nhận đã sửa, tài nguyên được khôi phục' }] },
  ]

  const chargingRequestEvents: ChargingRequestEvent[] = []
  const chargingQueueOrder: string[] = []
  const chargingQueueAdjustments: ChargingQueueAdjustment[] = []
  const dispatchOrders: DispatchOrder[] = []

  return {
    hubs, vehicles, vehicleReservations, chargingRequests, chargingPoints, chargingQueueOrder, chargingQueueAdjustments,
    parkingSlots, parkingReservations, privateEVs, chargingRequestEvents, incidents, dispatchOrders,
    simulationRun: undefined,
  }
}

export type SeedData = ReturnType<typeof createSeedData>
export const initialSeed = createSeedData()
export const initialChargingRequestEvents = initialSeed.chargingRequestEvents
