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

export interface Vehicle {
  vehicleId: VehicleId
  hubId: HubId
  battery: number
  status: VehicleStatus
  lastHeartbeat: string
  faultCode?: string
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
export interface OperationalIncident {
  incidentId: string
  assetId: string
  hubId: HubId
  title: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: IncidentStatus
  createdAt: string
}

export interface DispatchOrder {
  orderId: string
  sourceHubId: HubId
  destinationHubId: HubId
  vehicleIds: VehicleId[]
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export interface SimulationPreview {
  previewId: string
  sourceHubId: HubId
  destinationHubId: HubId
  vehicleIds: VehicleId[]
  generatedAt: string
  sourceAvailableCountAtPreview: number
  status: 'READY' | 'STALE' | 'APPLIED'
}
