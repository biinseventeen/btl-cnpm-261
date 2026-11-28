// Date, time and label formatting shared by every screen (vi-VN, local time).
import type { Hub } from '../types'

const pad = (value: number) => String(value).padStart(2, '0')

export const formatTime = (iso?: string) => {
  if (!iso) return '--:--'
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export const formatDate = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}
export const formatShortDate = (iso: string) => {
  const date = new Date(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
}
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`
export const formatClock = (now: number) => {
  const date = new Date(now)
  return `${formatDate(date.toISOString())} · ${formatTime(date.toISOString())}:${pad(date.getSeconds())}`
}
export const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`
}

// Values for <input type="date"> and <input type="time">, in local time
export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
export const combineDateTime = (date: string, time: string) => {
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? '' : value.toISOString()
}
export const roundUpMinutes = (timestamp: number, step: number) => {
  const date = new Date(timestamp)
  date.setSeconds(0, 0)
  date.setMinutes(Math.ceil(date.getMinutes() / step) * step)
  return date
}

export const hubLabel = (hub?: Hub) => hub ? `${hub.name} · ${hub.hubId}` : '—'
