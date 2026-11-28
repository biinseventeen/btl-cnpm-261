// Small helpers shared by the store slices.
import type { Hub } from '../types'

export const MINUTE = 60 * 1000

export type Fail<R extends string> = { ok: false; reason: R }

const dateStamp = (now: number) => {
  const date = new Date(now)
  return `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

// Readable, collision-free codes such as PK-261126-003 (numbering continues per prefix)
export const nextCode = (prefix: string, existingIds: string[], now: number) => {
  const max = existingIds.filter((id) => id.startsWith(`${prefix}-`))
    .reduce((highest, id) => Math.max(highest, Number(id.split('-').pop()) || 0), 0)
  return `${prefix}-${dateStamp(now)}-${String(max + 1).padStart(3, '0')}`
}

export const updateById = <T, K extends keyof T>(items: T[], key: K, id: T[K], change: Partial<T>) =>
  items.map((item) => item[key] === id ? { ...item, ...change } : item)

type HubCounter = 'heldSlots' | 'occupiedSlots' | 'incomingReserved'
export const adjustHub = (hubs: Hub[], hubId: string, change: Partial<Record<HubCounter, number>>) =>
  hubs.map((hub) => hub.hubId === hubId ? {
    ...hub,
    heldSlots: Math.max(0, hub.heldSlots + (change.heldSlots ?? 0)),
    occupiedSlots: Math.max(0, hub.occupiedSlots + (change.occupiedSlots ?? 0)),
    incomingReserved: Math.max(0, hub.incomingReserved + (change.incomingReserved ?? 0)),
  } : hub)

export const hubFreeSlots = (hub: Hub) => Math.max(0, hub.totalSlots - hub.occupiedSlots - hub.heldSlots - hub.incomingReserved)

export const hubUtilization = (hub: Hub) =>
  hub.totalSlots === 0 ? 0 : Math.min(100, Math.round(((hub.occupiedSlots + hub.heldSlots + hub.incomingReserved) / hub.totalSlots) * 100))

// Design threshold for overcrowding alerts
export const HUB_ALERT_UTILIZATION = 85
