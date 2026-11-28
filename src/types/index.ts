// Shared data contract. Update this file only after agreement from all module owners.
export type HubId = string
export type VehicleId = string

export type VehicleStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'IN_USE'
  | 'PENDING_CHARGING'
  | 'IN_TRANSIT'
  | 'UNAVAILABLE'
  | 'DISCONNECTED'

export interface Hub {
  hubId: HubId
  name: string
  address: string
  totalSlots: number
  occupiedSlots: number
  heldSlots: number
  incomingReserved: number
}

export type VehicleType = 'E_BIKE' | 'E_SCOOTER'

export interface Vehicle {
  vehicleId: VehicleId
  hubId: HubId
  battery: number
  status: VehicleStatus
  lastHeartbeat: string
  faultCode?: string
  vehicleType?: VehicleType
}

// One shared-vehicle booking; after the QR pickup the same record tracks the trip
export type VehicleReservationStatus = 'RESERVED' | 'IN_USE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
export interface VehicleReservation {
  reservationId: string
  studentId: string
  vehicleId: VehicleId
  hubId: HubId
  status: VehicleReservationStatus
  createdAt: string
  expiresAt: string
  pickedUpAt?: string
  startBattery?: number
  locked?: boolean
  returnedAt?: string
  returnHubId?: HubId
  returnOutcome?: VehicleStatus
}

export type ChargingRequestStatus =
  | 'NEEDS_VERIFICATION'
  | 'WAITING'
  | 'SCHEDULED'
  | 'CHARGING'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface ChargingRequest {
  requestId: string
  source: 'SYSTEM' | 'STUDENT'
  vehicleId: VehicleId
  hubId: HubId
  battery: number
  status: ChargingRequestStatus
  createdAt: string
  scheduledStart?: string
  chargingPointId?: string
  // Private EV requests (source STUDENT): vehicleId holds the PrivateEV evId
  requesterId?: string
  desiredStart?: string
  desiredEnd?: string
  nextUseAt?: string
  batteryVerified?: boolean
}

// Status history of private EV charging requests, recorded by the Parking module (PK-02f)
export type ChargingRequestEventType =
  | 'SUBMITTED' | 'SCHEDULED' | 'SCHEDULE_CHANGED' | 'RESCHEDULED'
  | 'CHARGING' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED'
export interface ChargingRequestEvent {
  eventId: string
  requestId: string
  type: ChargingRequestEventType
  at: string
  chargingPointId?: string
  scheduledStart?: string
  previousChargingPointId?: string
  previousScheduledStart?: string
}

export type ChargingPointStatus = 'AVAILABLE' | 'ASSIGNED' | 'CHARGING' | 'ERROR'
export interface ChargingPoint {
  chargingPointId: string
  hubId: HubId
  status: ChargingPointStatus
  powerKw: number
  vehicleId?: VehicleId
}

export type ParkingSlotStatus = 'FREE' | 'ASSIGNED' | 'OCCUPIED' | 'UNAVAILABLE'
export type ParkingSensorStatus = 'ONLINE' | 'STALE' | 'FAULT'
export interface ParkingSlot {
  slotId: string
  hubId: HubId
  status: ParkingSlotStatus
  sensorStatus: ParkingSensorStatus
  vehicleId?: string
}

export type ParkingReservationStatus =
  | 'HELD'
  | 'SLOT_ASSIGNED'
  | 'ARRIVED'
  | 'CHECK_IN_FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'COMPLETED'

export type ParkingFailureReason = 'HUB_FULL' | 'NO_PHYSICAL_SLOT' | 'SENSOR_UNAVAILABLE'

export interface ParkingReservation {
  reservationId: string
  studentId: string
  hubId: HubId
  status: ParkingReservationStatus
  evId?: string
  slotId?: string
  arrivalTime: string
  expiresAt: string
  createdAt: string
  checkedInAt?: string
  slotHoldExpiresAt?: string
  failureReason?: ParkingFailureReason
}

export interface PrivateEV {
  evId: string
  ownerStudentId: string
  plateNumber: string
  model: string
  // Missing or stale telemetry means the student enters the battery level manually
  battery?: number
  lastTelemetryAt?: string
}

export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export interface IncidentEvent {
  at: string
  action: string
}
export interface OperationalIncident {
  incidentId: string
  assetId: string
  hubId: HubId
  title: string
  severity: IncidentSeverity
  status: IncidentStatus
  createdAt: string
  faultCode?: string
  technicianNotifiedAt?: string
  resolvedAt?: string
  history?: IncidentEvent[]
}

export interface DispatchOrder {
  orderId: string
  sourceHubId: HubId
  destinationHubId: HubId
  vehicleIds: VehicleId[]
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  createdAt?: string
  etaMinutes?: number
  completedAt?: string
  origin?: 'MANUAL' | 'SIMULATION'
}

// Manual change of the charging queue order; the reason is mandatory (audit trail)
export interface ChargingQueueAdjustment {
  adjustmentId: string
  requestId: string
  fromPosition: number
  toPosition: number
  reason: string
  actor: string
  at: string
}

export type SimulationScenarioType = 'DEMAND_SURGE' | 'HUB_FULL' | 'POWER_OUTAGE' | 'CHARGER_FAULT' | 'DORM_CONCENTRATION'
export interface SimulationParams {
  scenario: SimulationScenarioType
  hubId: HubId
  scope: 'NETWORK' | 'LOCAL'
  demandChangePct: number
  durationMinutes: number
  windowStart: string
  extraTrips: number
  useSnapshot: boolean
}
export interface SimulationHubResult {
  hubId: HubId
  totalSlots: number
  snapshotAvailable: number
  snapshotParked: number
  afterDemandAvailable: number
  afterDemandParked: number
  afterPlanAvailable: number
  afterPlanParked: number
}
export type SimulationRecommendationKind = 'DISPATCH' | 'CHARGING_PRIORITY' | 'REDIRECT'
export interface SimulationRecommendation {
  recommendationId: string
  kind: SimulationRecommendationKind
  title: string
  description: string
  precheck: string
  sourceHubId?: HubId
  destinationHubId?: HubId
  vehicleIds?: VehicleId[]
  requestIds?: string[]
  // Live condition re-checked on apply: source must still hold at least this many eligible vehicles
  minSourceAvailable?: number
  minDestinationFree?: number
  status: 'PROPOSED' | 'APPLIED' | 'STALE'
  staleReason?: string
  decidedAt?: string
}
export interface SimulationRun {
  runId: string
  snapshotId: string
  snapshotAt: string
  params: SimulationParams
  status: 'COMPLETED' | 'INVALID' | 'TIMEOUT'
  estimatedSeconds: number
  error?: string
  hubResults: SimulationHubResult[]
  recommendations: SimulationRecommendation[]
}
