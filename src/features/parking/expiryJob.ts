import { useMobilityStore } from '../../store/useMobilityStore'

// Browser stand-in for ParkingExpiryJob (Sub3 5.4): releases holds whose deadline has passed.
const SWEEP_INTERVAL_MS = 5000
let started = false

export function startParkingExpiryJob() {
  if (started || typeof window === 'undefined') return
  started = true
  window.setInterval(() => useMobilityStore.getState().sweepParkingExpiry(), SWEEP_INTERVAL_MS)
}
