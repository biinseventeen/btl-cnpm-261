import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialSeed } from '../data/mockData'
import { useMobilityStore } from './useMobilityStore'
import { diffChargingRequests, PARKING_RULES } from './parkingSlice'
import type { ChargingRequest, ParkingSlot } from '../types'

const S = () => useMobilityStore.getState()
const hub = (hubId: string) => S().hubs.find((item) => item.hubId === hubId)!
const slot = (slotId: string) => S().parkingSlots.find((item) => item.slotId === slotId)!
const reservation = (id: string) => S().parkingReservations.find((item) => item.reservationId === id)!
const request = (id: string) => S().chargingRequests.find((item) => item.requestId === id)!
const point = (id: string) => S().chargingPoints.find((item) => item.chargingPointId === id)!

const MINUTE = 60 * 1000
// H1 occupiedSlots also counts the shared vehicles parked there
const H1_BASE = initialSeed.hubs.find((item) => item.hubId === 'H1')!.occupiedSlots
const START = new Date('2026-11-26T08:00:00+07:00').getTime()
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * MINUTE).toISOString()
const advance = (minutes: number) => vi.setSystemTime(Date.now() + minutes * MINUTE)

const setSlots = (change: (slots: ParkingSlot[]) => ParkingSlot[]) => useMobilityStore.setState((state) => ({ parkingSlots: change(state.parkingSlots) }))
const patchSlot = (slotId: string, patch: Partial<ParkingSlot>) => setSlots((slots) => slots.map((item) => item.slotId === slotId ? { ...item, ...patch } : item))

const reserve = (studentId = 'S-02', hubId = 'H1', minutes = 30, evId?: string) => {
  const result = S().reserveParking({ studentId, hubId, arrivalTime: inMinutes(minutes), evId })
  if (!result.ok) throw new Error(`reserve failed: ${result.reason}`)
  return result.reservationId
}

const chargingInput = (overrides: Partial<Parameters<ReturnType<typeof S>['submitPrivateEvChargingRequest']>[0]> = {}) => ({
  studentId: 'S-02', evId: 'PE-021', hubId: 'H1', desiredStart: inMinutes(30), desiredEnd: inMinutes(90), ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  S().resetDemo()
})
afterEach(() => vi.useRealTimers())

describe('seed data', () => {
  it('keeps H1 counters consistent with the slot map and reservations', () => {
    const h1Occupied = S().parkingSlots.filter((item) => item.hubId === 'H1' && item.status === 'OCCUPIED').length
    const h1Vehicles = S().vehicles.filter((item) => item.hubId === 'H1' && item.status !== 'IN_USE' && item.status !== 'IN_TRANSIT').length
    expect(h1Occupied + h1Vehicles).toBe(hub('H1').occupiedSlots)
    expect(S().parkingReservations.filter((item) => item.hubId === 'H1' && item.status === 'HELD')).toHaveLength(hub('H1').heldSlots)
  })
})

describe('reserveParking', () => {
  it('holds one unit of hub capacity without assigning a slot', () => {
    const id = reserve('S-02', 'H1', 30, 'PE-018')
    const created = reservation(id)
    expect(id).toBe('PK-261126-001')
    expect(created).toMatchObject({ status: 'HELD', evId: 'PE-018' })
    expect(created.slotId).toBeUndefined()
    expect(new Date(created.expiresAt).getTime() - new Date(created.arrivalTime).getTime()).toBe(15 * MINUTE)
    expect(hub('H1').heldSlots).toBe(2)
  })

  it('rejects a second open reservation at the same hub but allows another hub', () => {
    reserve('S-02', 'H1')
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H1', arrivalTime: inMinutes(40) })).toEqual({ ok: false, reason: 'DUPLICATE_RESERVATION' })
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H2', arrivalTime: inMinutes(40) }).ok).toBe(true)
    expect(hub('H1').heldSlots).toBe(2)
  })

  it('rejects a full hub and gives the last unit to only one student (TC-PK-01)', () => {
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H3', arrivalTime: inMinutes(30) })).toEqual({ ok: false, reason: 'HUB_FULL' })
    useMobilityStore.setState((state) => ({ hubs: state.hubs.map((item) => item.hubId === 'H2' ? { ...item, occupiedSlots: item.totalSlots - 1 } : item) }))
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H2', arrivalTime: inMinutes(30) }).ok).toBe(true)
    expect(S().reserveParking({ studentId: 'S-05', hubId: 'H2', arrivalTime: inMinutes(30) })).toEqual({ ok: false, reason: 'HUB_FULL' })
    expect(hub('H2').heldSlots).toBe(1)
  })

  it('accepts arrivals up to 2 hours ahead only', () => {
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H1', arrivalTime: inMinutes(121) })).toEqual({ ok: false, reason: 'INVALID_ARRIVAL_TIME' })
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H1', arrivalTime: inMinutes(-5) })).toEqual({ ok: false, reason: 'INVALID_ARRIVAL_TIME' })
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H1', arrivalTime: 'not a date' })).toEqual({ ok: false, reason: 'INVALID_ARRIVAL_TIME' })
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H1', arrivalTime: inMinutes(120) }).ok).toBe(true)
  })

  it('rejects unknown hubs and vehicles the student does not own', () => {
    expect(S().reserveParking({ studentId: 'S-02', hubId: 'H9', arrivalTime: inMinutes(30) })).toEqual({ ok: false, reason: 'HUB_NOT_FOUND' })
    expect(S().reserveParking({ studentId: 'S-01', hubId: 'H1', arrivalTime: inMinutes(30), evId: 'PE-018' })).toEqual({ ok: false, reason: 'EV_NOT_OWNED' })
  })
})

describe('cancelParkingReservation', () => {
  it('releases the capacity exactly once', () => {
    const id = reserve()
    expect(S().cancelParkingReservation('S-02', id)).toEqual({ ok: true })
    expect(reservation(id).status).toBe('CANCELLED')
    expect(hub('H1').heldSlots).toBe(1)
    expect(S().cancelParkingReservation('S-02', id)).toEqual({ ok: false, reason: 'INVALID_STATE' })
    expect(hub('H1').heldSlots).toBe(1)
  })

  it('frees the assigned slot when cancelled after check-in', () => {
    const id = reserve()
    S().checkInParking('S-02', id)
    S().cancelParkingReservation('S-02', id)
    expect(slot('A-12')).toMatchObject({ status: 'FREE', vehicleId: undefined })
    expect(hub('H1').heldSlots).toBe(1)
  })

  it('refuses other students and unknown reservations', () => {
    const id = reserve()
    expect(S().cancelParkingReservation('S-09', id)).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().cancelParkingReservation('S-02', 'PK-000')).toEqual({ ok: false, reason: 'NOT_FOUND' })
  })
})

describe('checkInParking', () => {
  it('assigns the first FREE slot with an ONLINE sensor and keeps capacity held (TC-PK-04)', () => {
    const id = reserve('S-02', 'H1', 30, 'PE-018')
    expect(S().checkInParking('S-02', id)).toEqual({ ok: true, slotId: 'A-12' })
    const updated = reservation(id)
    expect(updated).toMatchObject({ status: 'SLOT_ASSIGNED', slotId: 'A-12' })
    expect(new Date(updated.slotHoldExpiresAt!).getTime() - Date.now()).toBe(PARKING_RULES.slotHoldMinutes * MINUTE)
    expect(slot('A-12')).toMatchObject({ status: 'ASSIGNED', vehicleId: 'PE-018' })
    expect(slot('A-03').status).toBe('FREE') // stale sensor, skipped
    expect(hub('H1')).toMatchObject({ heldSlots: 2, occupiedSlots: H1_BASE })
  })

  it('ignores a repeated check-in', () => {
    const id = reserve()
    S().checkInParking('S-02', id)
    expect(S().checkInParking('S-02', id)).toEqual({ ok: false, reason: 'INVALID_STATE' })
    expect(S().parkingSlots.filter((item) => item.status === 'ASSIGNED')).toHaveLength(1)
  })

  it('gives the last reliable slot to one reservation and fails the other (TC-PK-05, TC-PK-06, TC-PK-11)', () => {
    patchSlot('A-14', { status: 'OCCUPIED' })
    const first = reserve('S-02')
    const second = reserve('S-05')
    expect(S().checkInParking('S-02', first)).toEqual({ ok: true, slotId: 'A-12' })
    const incidentsBefore = S().incidents.length
    expect(S().checkInParking('S-05', second)).toEqual({ ok: false, reason: 'SENSOR_UNAVAILABLE' })
    expect(reservation(second)).toMatchObject({ status: 'CHECK_IN_FAILED', failureReason: 'SENSOR_UNAVAILABLE' })
    expect(hub('H1').heldSlots).toBe(2) // PR-001 + first
    expect(S().incidents).toHaveLength(incidentsBefore + 1)
    expect(S().incidents.at(-1)).toMatchObject({ hubId: 'H1', status: 'OPEN' })
  })

  it('reports NO_PHYSICAL_SLOT when no slot is free at all', () => {
    setSlots((slots) => slots.map((item) => item.hubId === 'H1' && item.status === 'FREE' ? { ...item, status: 'OCCUPIED' } : item))
    const id = reserve()
    expect(S().checkInParking('S-02', id)).toEqual({ ok: false, reason: 'NO_PHYSICAL_SLOT' })
  })

  it('expires instead of checking in after the hold deadline', () => {
    const id = reserve('S-02', 'H1', 10)
    advance(26)
    expect(S().checkInParking('S-02', id)).toEqual({ ok: false, reason: 'EXPIRED' })
    expect(hub('H1').heldSlots).toBe(1)
    expect(slot('A-12').status).toBe('FREE')
  })

  it('refuses other students', () => {
    const id = reserve()
    expect(S().checkInParking('S-09', id)).toEqual({ ok: false, reason: 'NOT_OWNER' })
  })
})

describe('reportSlotSensor', () => {
  it('commits the reservation when the vehicle enters the assigned slot (TC-PK-07)', () => {
    const id = reserve()
    S().checkInParking('S-02', id)
    expect(S().reportSlotSensor('A-12', 'OCCUPIED')).toBe('ARRIVED')
    expect(reservation(id).status).toBe('ARRIVED')
    expect(slot('A-12').status).toBe('OCCUPIED')
    expect(hub('H1')).toMatchObject({ heldSlots: 1, occupiedSlots: H1_BASE + 1 })
    expect(S().reportSlotSensor('A-12', 'OCCUPIED')).toBe('IGNORED')
    expect(hub('H1').occupiedSlots).toBe(H1_BASE + 1)
  })

  it('completes the reservation when the vehicle leaves', () => {
    const id = reserve()
    S().checkInParking('S-02', id)
    S().reportSlotSensor('A-12', 'OCCUPIED')
    expect(S().reportSlotSensor('A-12', 'FREE')).toBe('COMPLETED')
    expect(reservation(id).status).toBe('COMPLETED')
    expect(slot('A-12').status).toBe('FREE')
    expect(hub('H1').occupiedSlots).toBe(H1_BASE)
  })

  it('does not commit after the slot hold ran out (TC-PK-09)', () => {
    const id = reserve('S-02', 'H1', 60)
    S().checkInParking('S-02', id)
    advance(11)
    expect(S().reportSlotSensor('A-12', 'OCCUPIED')).toBe('UNEXPECTED_OCCUPANCY')
    expect(reservation(id)).toMatchObject({ status: 'HELD', slotId: undefined })
  })

  it('ignores readings from sensors that are not ONLINE', () => {
    const id = reserve()
    S().checkInParking('S-02', id)
    S().setSlotSensorStatus('A-12', 'STALE')
    expect(S().reportSlotSensor('A-12', 'OCCUPIED')).toBe('IGNORED')
    expect(reservation(id).status).toBe('SLOT_ASSIGNED')
    expect(S().reportSlotSensor('A-06', 'OCCUPIED')).toBe('IGNORED')
  })

  it('flags a vehicle parked without a reservation and frees the slot when it leaves', () => {
    const incidentsBefore = S().incidents.length
    expect(S().reportSlotSensor('A-14', 'OCCUPIED')).toBe('UNEXPECTED_OCCUPANCY')
    expect(S().incidents).toHaveLength(incidentsBefore + 1)
    expect(hub('H1').occupiedSlots).toBe(H1_BASE + 1)
    expect(S().reportSlotSensor('A-14', 'FREE')).toBe('VEHICLE_LEFT')
    expect(hub('H1').occupiedSlots).toBe(H1_BASE)
  })
})

describe('setSlotSensorStatus', () => {
  it('raises one incident when a sensor goes FAULT', () => {
    const before = S().incidents.length
    S().setSlotSensorStatus('A-12', 'FAULT')
    S().setSlotSensorStatus('A-12', 'FAULT')
    expect(S().incidents).toHaveLength(before + 1)
    expect(slot('A-12').sensorStatus).toBe('FAULT')
    S().setSlotSensorStatus('A-12', 'ONLINE')
    expect(S().incidents).toHaveLength(before + 1)
  })
})

describe('sweepParkingExpiry', () => {
  it('expires HELD reservations only after arrival + 15 minutes (TC-PK-10)', () => {
    const id = reserve('S-02', 'H1', 30)
    advance(45)
    expect(S().sweepParkingExpiry()).toBe(0)
    advance(1)
    expect(S().sweepParkingExpiry()).toBe(1)
    expect(reservation(id).status).toBe('EXPIRED')
    expect(S().sweepParkingExpiry()).toBe(0)
    expect(hub('H1').heldSlots).toBe(1) // only the seed PR-001, which runs until +75 minutes
  })

  it('gives the slot back after 10 minutes without a sensor confirmation (TC-PK-08)', () => {
    const id = reserve('S-02', 'H1', 60)
    S().checkInParking('S-02', id)
    advance(10)
    expect(S().sweepParkingExpiry()).toBe(0)
    advance(1)
    S().sweepParkingExpiry()
    expect(reservation(id)).toMatchObject({ status: 'HELD', slotId: undefined, slotHoldExpiresAt: undefined })
    expect(slot('A-12')).toMatchObject({ status: 'FREE', vehicleId: undefined })
    expect(hub('H1').heldSlots).toBe(2)
    expect(S().checkInParking('S-02', id)).toEqual({ ok: true, slotId: 'A-12' })
  })

  it('expires a slot hold that outlives the capacity hold', () => {
    const id = reserve('S-02', 'H1', 0)
    advance(10)
    S().checkInParking('S-02', id)
    advance(11)
    S().sweepParkingExpiry()
    expect(reservation(id).status).toBe('EXPIRED')
    expect(slot('A-12').status).toBe('FREE')
    expect(hub('H1').heldSlots).toBe(1)
  })
})

describe('checkOutParking', () => {
  it('completes only ARRIVED reservations', () => {
    const id = reserve()
    expect(S().checkOutParking('S-02', id)).toEqual({ ok: false, reason: 'INVALID_STATE' })
    S().checkInParking('S-02', id)
    S().reportSlotSensor('A-12', 'OCCUPIED')
    expect(S().checkOutParking('S-09', id)).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().checkOutParking('S-02', id)).toEqual({ ok: true })
    expect(reservation(id).status).toBe('COMPLETED')
    expect(slot('A-12').status).toBe('FREE')
    expect(hub('H1')).toMatchObject({ heldSlots: 1, occupiedSlots: H1_BASE })
  })
})

describe('submitPrivateEvChargingRequest', () => {
  it('queues a verified request from telemetry without touching charging points (TC-PK-12, TC-PK-15)', () => {
    const pointsBefore = S().chargingPoints
    const result = S().submitPrivateEvChargingRequest(chargingInput({ nextUseAt: inMinutes(180) }))
    expect(result).toEqual({ ok: true, requestId: 'CQ-261126-001' })
    expect(request('CQ-261126-001')).toMatchObject({
      source: 'STUDENT', vehicleId: 'PE-021', requesterId: 'S-02', status: 'WAITING', battery: 35, batteryVerified: true,
    })
    expect(request('CQ-261126-001').chargingPointId).toBeUndefined()
    expect(request('CQ-261126-001').scheduledStart).toBeUndefined()
    expect(S().chargingPoints).toBe(pointsBefore)
  })

  it('requires a confirmed manual battery level when there is no telemetry (TC-PK-13)', () => {
    const base = chargingInput({ evId: 'PE-018' })
    expect(S().submitPrivateEvChargingRequest(base)).toEqual({ ok: false, reason: 'BATTERY_REQUIRED' })
    expect(S().submitPrivateEvChargingRequest({ ...base, manualBattery: 150, manualBatteryConfirmed: true })).toEqual({ ok: false, reason: 'INVALID_BATTERY' })
    expect(S().submitPrivateEvChargingRequest({ ...base, manualBattery: 18.5, manualBatteryConfirmed: true })).toEqual({ ok: false, reason: 'INVALID_BATTERY' })
    expect(S().submitPrivateEvChargingRequest({ ...base, manualBattery: 18 })).toEqual({ ok: false, reason: 'BATTERY_NOT_CONFIRMED' })
    const result = S().submitPrivateEvChargingRequest({ ...base, manualBattery: 18, manualBatteryConfirmed: true })
    expect(result.ok).toBe(true)
    if (result.ok) expect(request(result.requestId)).toMatchObject({ status: 'WAITING', battery: 18, batteryVerified: false })
  })

  it('treats telemetry older than 30 minutes as missing', () => {
    advance(31)
    expect(S().submitPrivateEvChargingRequest(chargingInput())).toEqual({ ok: false, reason: 'BATTERY_REQUIRED' })
  })

  it('rejects a second active request for the same vehicle until the first is cancelled', () => {
    const first = S().submitPrivateEvChargingRequest(chargingInput())
    expect(S().submitPrivateEvChargingRequest(chargingInput())).toEqual({ ok: false, reason: 'DUPLICATE_REQUEST' })
    if (first.ok) S().cancelChargingRequest('S-02', first.requestId)
    expect(S().submitPrivateEvChargingRequest(chargingInput())).toEqual({ ok: true, requestId: 'CQ-261126-002' })
  })

  it('validates the time window, owner, vehicle and hub', () => {
    expect(S().submitPrivateEvChargingRequest(chargingInput({ desiredEnd: inMinutes(30) }))).toEqual({ ok: false, reason: 'INVALID_WINDOW' })
    expect(S().submitPrivateEvChargingRequest(chargingInput({ desiredStart: inMinutes(-90), desiredEnd: inMinutes(-30) }))).toEqual({ ok: false, reason: 'INVALID_WINDOW' })
    expect(S().submitPrivateEvChargingRequest(chargingInput({ studentId: 'S-01' }))).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().submitPrivateEvChargingRequest(chargingInput({ evId: 'PE-999' }))).toEqual({ ok: false, reason: 'EV_NOT_FOUND' })
    expect(S().submitPrivateEvChargingRequest(chargingInput({ hubId: 'H9' }))).toEqual({ ok: false, reason: 'HUB_NOT_FOUND' })
  })
})

describe('cancelChargingRequest', () => {
  it('only lets the requester cancel their own pending request', () => {
    const result = S().submitPrivateEvChargingRequest(chargingInput())
    if (!result.ok) throw new Error(result.reason)
    expect(S().cancelChargingRequest('S-09', result.requestId)).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().cancelChargingRequest('S-02', 'CR-001')).toEqual({ ok: false, reason: 'NOT_OWNER' })
    expect(S().cancelChargingRequest('S-02', 'CQ-000')).toEqual({ ok: false, reason: 'NOT_FOUND' })
    useMobilityStore.setState((state) => ({ chargingRequests: state.chargingRequests.map((item) => item.requestId === result.requestId ? { ...item, status: 'CHARGING' } : item) }))
    expect(S().cancelChargingRequest('S-02', result.requestId)).toEqual({ ok: false, reason: 'INVALID_STATE' })
  })

  it('returns the assigned charging point when a scheduled request is cancelled', () => {
    const result = S().submitPrivateEvChargingRequest(chargingInput())
    if (!result.ok) throw new Error(result.reason)
    S().scheduleChargingRequest(result.requestId, 'CP-H1-01')
    expect(point('CP-H1-01')).toMatchObject({ status: 'ASSIGNED', vehicleId: 'PE-021' })
    expect(S().cancelChargingRequest('S-02', result.requestId)).toEqual({ ok: true })
    expect(request(result.requestId).status).toBe('CANCELLED')
    expect(point('CP-H1-01')).toMatchObject({ status: 'AVAILABLE', vehicleId: undefined })
  })
})

describe('charging request history', () => {
  it('records submit, schedule, reschedule and expiry from any module (TC-PK-14)', () => {
    const result = S().submitPrivateEvChargingRequest(chargingInput())
    if (!result.ok) throw new Error(result.reason)
    const id = result.requestId
    S().scheduleChargingRequest(id, 'CP-H1-01')
    useMobilityStore.setState((state) => ({
      chargingRequests: state.chargingRequests.map((item) => item.requestId === id ? { ...item, status: 'WAITING', chargingPointId: undefined, scheduledStart: undefined } : item),
    }))
    useMobilityStore.setState((state) => ({ chargingRequests: state.chargingRequests.map((item) => item.requestId === id ? { ...item, status: 'EXPIRED' } : item) }))
    const events = S().chargingRequestEvents.filter((event) => event.requestId === id)
    expect(events.map((event) => event.type)).toEqual(['SUBMITTED', 'SCHEDULED', 'RESCHEDULED', 'EXPIRED'])
    expect(events[1].chargingPointId).toBe('CP-H1-01')
    expect(events[2].previousChargingPointId).toBe('CP-H1-01')
    expect(new Set(S().chargingRequestEvents.map((event) => event.eventId)).size).toBe(S().chargingRequestEvents.length)
  })

  it('ignores system requests and detects a changed schedule', () => {
    const base: ChargingRequest = { requestId: 'CQ-1', source: 'STUDENT', vehicleId: 'PE-021', hubId: 'H1', battery: 35, status: 'SCHEDULED', createdAt: '', chargingPointId: 'CP-1', scheduledStart: 'a' }
    const system: ChargingRequest = { ...base, requestId: 'CR-9', source: 'SYSTEM' }
    expect(diffChargingRequests([], [system], 'now')).toEqual([])
    expect(diffChargingRequests([base], [{ ...base, chargingPointId: 'CP-2' }], 'now')).toEqual([
      expect.objectContaining({ type: 'SCHEDULE_CHANGED', chargingPointId: 'CP-2', previousChargingPointId: 'CP-1' }),
    ])
    expect(diffChargingRequests([base], [base], 'now')).toEqual([])
    const unscheduled = { ...base, scheduledStart: undefined }
    expect(diffChargingRequests([unscheduled], [base], 'now')).toEqual([expect.objectContaining({ type: 'SCHEDULED', scheduledStart: 'a' })])
    expect(diffChargingRequests([base], [{ ...base, scheduledStart: 'b' }], 'now')).toEqual([
      expect.objectContaining({ type: 'SCHEDULE_CHANGED', previousScheduledStart: 'a', scheduledStart: 'b' }),
    ])
  })

  it('is cleared by resetDemo', () => {
    S().submitPrivateEvChargingRequest(chargingInput())
    S().resetDemo()
    expect(S().chargingRequestEvents).toEqual([])
  })
})

describe('invariants under random operations', () => {
  it('keeps hub counters, slots and reservations consistent', () => {
    let seed = 42
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
    const students = ['S-02', 'S-05', 'S-06', 'S-07']
    const hubIds = ['H1', 'H2']
    const baseOccupied = Object.fromEntries(S().hubs.map((item) => [item.hubId, item.occupiedSlots - S().parkingSlots.filter((s) => s.hubId === item.hubId && s.status === 'OCCUPIED').length]))

    for (let step = 0; step < 600; step += 1) {
      const open = S().parkingReservations.filter((item) => item.studentId !== 'S-03')
      const target = open.length ? pick(open) : undefined
      switch (Math.floor(random() * 8)) {
        case 0: S().reserveParking({ studentId: pick(students), hubId: pick(hubIds), arrivalTime: inMinutes(Math.floor(random() * 60)) }); break
        case 1: if (target) S().checkInParking(target.studentId, target.reservationId); break
        case 2: if (target) S().cancelParkingReservation(target.studentId, target.reservationId); break
        case 3: {
          const busy = S().parkingSlots.filter((item) => item.status === 'ASSIGNED' || item.status === 'OCCUPIED')
          if (busy.length) { const chosen = pick(busy); S().reportSlotSensor(chosen.slotId, chosen.status === 'ASSIGNED' ? 'OCCUPIED' : 'FREE') }
          break
        }
        case 4: advance(Math.floor(random() * 8)); S().sweepParkingExpiry(); break
        case 5: if (target) S().checkOutParking(target.studentId, target.reservationId); break
        case 6: S().setSlotSensorStatus(pick(['A-12', 'A-14', 'B-07']), pick(['ONLINE', 'ONLINE', 'STALE', 'FAULT'] as const)); break
        case 7: if (target) S().checkInParking(target.studentId, target.reservationId); break
      }

      for (const item of S().hubs) {
        const holding = S().parkingReservations.filter((r) => r.hubId === item.hubId && (r.status === 'HELD' || r.status === 'SLOT_ASSIGNED')).length
        expect(item.heldSlots, `held ${item.hubId} step ${step}`).toBe(holding)
        const occupiedSlots = S().parkingSlots.filter((s) => s.hubId === item.hubId && s.status === 'OCCUPIED').length
        expect(item.occupiedSlots, `occupied ${item.hubId} step ${step}`).toBe(baseOccupied[item.hubId] + occupiedSlots)
        expect(item.occupiedSlots + item.heldSlots + item.incomingReserved).toBeLessThanOrEqual(item.totalSlots)
      }
      for (const s of S().parkingSlots.filter((x) => x.status === 'ASSIGNED')) {
        expect(S().parkingReservations.filter((r) => r.status === 'SLOT_ASSIGNED' && r.slotId === s.slotId)).toHaveLength(1)
      }
      for (const r of S().parkingReservations.filter((x) => x.status === 'SLOT_ASSIGNED' || x.status === 'ARRIVED')) {
        expect(slot(r.slotId!).status).toBe(r.status === 'SLOT_ASSIGNED' ? 'ASSIGNED' : 'OCCUPIED')
      }
    }
    const statuses = new Set(S().parkingReservations.map((r) => r.status))
    expect([...statuses]).toEqual(expect.arrayContaining(['HELD', 'CANCELLED', 'EXPIRED', 'COMPLETED']))
  })
})
