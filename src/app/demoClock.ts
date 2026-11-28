import { useMobilityStore } from '../store/useMobilityStore'

// Browser stand-in for the background jobs of the design (ParkingExpiryJob, reservation expiry,
// charging request expiry) and for the vehicle IoT feed (heartbeat every few seconds, battery drain).
const TICK_MS = 5000
let started = false

export function startDemoClock() {
  if (started || typeof window === 'undefined') return
  started = true
  window.setInterval(() => {
    const store = useMobilityStore.getState()
    store.tickVehicleTelemetry()
    store.sweepParkingExpiry()
    store.sweepVehicleReservations()
    store.expireChargingRequests()
  }, TICK_MS)
}
