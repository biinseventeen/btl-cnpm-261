// PK-01 (Figma 144:3) and PK-01g (146:2): book parking capacity at a hub.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { SquareParking } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { availableCapacity, OPEN_RESERVATION_STATUSES, PARKING_RULES } from '../../../store/parkingSlice'
import type { ParkingReservation } from '../../../types'
import { DEMO_STUDENT_ID } from '../constants'
import {
  checkInErrorMessage, combineDateTime, formatCountdown, formatDateTime, formatShortDate, formatTime, hubLabel,
  reserveErrorMessage, roundUpMinutes, toDateInput, toTimeInput,
} from '../format'
import { useNow } from '../../../lib/useNow'
import { BigCode, Button, Card, CardTitle, DetailRow, Field, inputClass, LifecycleCard, Notice, PageHeader, PolicyNote, StatusTag } from '../ui'

const MINUTE = 60 * 1000

export default function ParkingReservePage() {
  const now = useNow()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hubs = useMobilityStore((s) => s.hubs)
  const privateEVs = useMobilityStore((s) => s.privateEVs)
  const reservations = useMobilityStore((s) => s.parkingReservations)
  const reserveParking = useMobilityStore((s) => s.reserveParking)
  const cancelReservation = useMobilityStore((s) => s.cancelParkingReservation)
  const checkIn = useMobilityStore((s) => s.checkInParking)

  const myVehicles = useMemo(() => privateEVs.filter((ev) => ev.ownerStudentId === DEMO_STUDENT_ID), [privateEVs])
  const [tab, setTab] = useState<'private' | 'shared'>('private')
  const [hubId, setHubId] = useState(() => {
    const requested = searchParams.get('hubId')
    return hubs.some((hub) => hub.hubId === requested) ? requested! : hubs[0]?.hubId ?? ''
  })
  const [evId, setEvId] = useState(myVehicles[0]?.evId ?? '')
  const [date, setDate] = useState(() => toDateInput(roundUpMinutes(Date.now() + 30 * MINUTE, 5)))
  const [time, setTime] = useState(() => toTimeInput(roundUpMinutes(Date.now() + 30 * MINUTE, 5)))
  const [message, setMessage] = useState<string>()

  const hub = hubs.find((item) => item.hubId === hubId)
  const arrivalTime = combineDateTime(date, time)
  const arrival = arrivalTime ? new Date(arrivalTime).getTime() : NaN
  const timeValid = !Number.isNaN(arrival) && arrival >= now - MINUTE && arrival <= now + PARKING_RULES.maxLeadMinutes * MINUTE
  const available = hub ? availableCapacity(hub) : 0
  const alternatives = hubs.filter((item) => item.hubId !== hubId && availableCapacity(item) > 0)
    .sort((a, b) => availableCapacity(b) - availableCapacity(a)).slice(0, 3)

  const mine = reservations.filter((item) => item.studentId === DEMO_STUDENT_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = mine[0]
  const otherOpen = mine.slice(1).filter((item) => OPEN_RESERVATION_STATUSES.includes(item.status))
  const openAtHub = mine.find((item) => item.hubId === hubId && OPEN_RESERVATION_STATUSES.includes(item.status))
  const vehicle = myVehicles.find((ev) => ev.evId === evId)
  const canSubmit = tab === 'private' && !!hub && !!vehicle && timeValid && available > 0 && !openAtHub

  const submit = () => {
    const result = reserveParking({ studentId: DEMO_STUDENT_ID, hubId, arrivalTime, evId })
    setMessage(result.ok ? undefined : reserveErrorMessage[result.reason])
  }

  const startCheckIn = (reservation: ParkingReservation) => {
    const result = checkIn(DEMO_STUDENT_ID, reservation.reservationId)
    if (result.ok || ['NO_PHYSICAL_SLOT', 'SENSOR_UNAVAILABLE'].includes(result.reason)) {
      navigate(`/student/parking/${reservation.reservationId}`)
    } else {
      setMessage(checkInErrorMessage[result.reason])
    }
  }

  const cancel = (reservation: ParkingReservation) => {
    const result = cancelReservation(DEMO_STUDENT_ID, reservation.reservationId)
    setMessage(result.ok ? undefined : 'Không hủy được: đơn đã đổi trạng thái.')
  }

  return <div className="space-y-6">
    <PageHeader now={now}
      eyebrow={current?.status === 'EXPIRED' ? `Chỗ đỗ / Đơn ${current.reservationId}` : 'Chỗ đỗ / Lập kế hoạch đến Hub'}
      title="Chủ động chỗ đỗ khi đến Hub"
      subtitle="Dành cho xe điện cá nhân và xe dùng chung. Chọn thời điểm đến để kiểm tra giữ chỗ." />

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Thông tin đặt chỗ" subtitle="Lên kế hoạch cho lần đến Hub tiếp theo · đặt trước tối đa 2 giờ" />
          <div role="tablist" className="mb-5 flex gap-2 border-b border-[#e4ece9] pb-4">
            {([['private', 'Xe cá nhân'], ['shared', 'Xe dùng chung']] as const).map(([value, label]) =>
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-[#e6f4ef] text-[#087f6a]' : 'text-[#5f716c] hover:bg-[#f4f7f6]'}`}>{label}</button>)}
          </div>

          {tab === 'shared' ? <Notice tone="info" title="Chỗ đỗ cho xe dùng chung được kiểm tra khi trả xe">
            Xe dùng chung không cần đặt chỗ trước. Khi trả xe ở mục <Link to="/student/vehicles" className="font-semibold underline">Hành trình của tôi</Link>, hệ thống kiểm tra sức chứa Hub đích.
          </Notice> : <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hub muốn đỗ" htmlFor="pk-hub">
                <select id="pk-hub" className={inputClass} value={hubId} onChange={(event) => { setHubId(event.target.value); setMessage(undefined) }}>
                  {hubs.map((item) => <option key={item.hubId} value={item.hubId}>{hubLabel(item)}</option>)}
                </select>
              </Field>
              <Field label="Phương tiện" htmlFor="pk-ev">
                <select id="pk-ev" className={inputClass} value={evId} onChange={(event) => setEvId(event.target.value)}>
                  {myVehicles.map((ev) => <option key={ev.evId} value={ev.evId}>{ev.evId} · Xe máy điện cá nhân</option>)}
                </select>
              </Field>
              <Field label="Ngày đến" htmlFor="pk-date">
                <input id="pk-date" type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
              </Field>
              <Field label="Giờ đến dự kiến" htmlFor="pk-time">
                <input id="pk-time" type="time" className={inputClass} value={time} onChange={(event) => setTime(event.target.value)} />
              </Field>
            </div>
            <div className="mt-5">
              {!timeValid ? <Notice tone="warn" title="Giờ đến chưa hợp lệ">Chỉ đặt được cho giờ đến trong 2 giờ tới (đến {formatTime(new Date(now + PARKING_RULES.maxLeadMinutes * MINUTE).toISOString())}).</Notice>
                : available <= 0 ? <Notice tone="danger" title={`${hub?.name ?? 'Hub'} đã hết chỗ`}>
                  <p>{hub?.occupiedSlots}/{hub?.totalSlots} chỗ đang dùng, còn {hub?.incomingReserved ?? 0} chỗ dành cho xe đang tới. {alternatives.length ? 'Hub còn chỗ:' : 'Hiện không Hub nào còn chỗ.'}</p>
                  {alternatives.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{alternatives.map((item) =>
                    <button key={item.hubId} type="button" onClick={() => { setHubId(item.hubId); setMessage(undefined) }}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#087f6a]">{item.name} · {availableCapacity(item)} chỗ trống</button>)}</div>}
                </Notice>
                : <Notice tone="success" title="Khung giờ này còn chỗ">
                  Hiện tại {hub?.name}: {hub!.occupiedSlots + hub!.heldSlots + hub!.incomingReserved}/{hub?.totalSlots} đang dùng hoặc đã giữ, {available} chỗ trống. Hệ thống kiểm tra lại khi bạn xác nhận.
                </Notice>}
            </div>
          </>}
        </Card>

        <LifecycleCard status={current?.status} />
        <PolicyNote arrivalTime={current && OPEN_RESERVATION_STATUSES.includes(current.status) ? current.arrivalTime : arrivalTime || undefined}
          expiresAt={current && OPEN_RESERVATION_STATUSES.includes(current.status) ? current.expiresAt : arrivalTime ? new Date(arrival + PARKING_RULES.capacityGraceMinutes * MINUTE).toISOString() : undefined} />
      </div>

      <aside className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Xem lại yêu cầu" />
          <DetailRow label="Hub" value={hub?.name ?? '—'} />
          <DetailRow label="Loại sử dụng" value={tab === 'private' ? `Xe cá nhân · ${evId || '—'}` : 'Xe dùng chung'} />
          <DetailRow label="Ngày, giờ đến" value={arrivalTime ? formatDateTime(arrivalTime) : '—'} />
          <DetailRow label="Chỗ đỗ" value="Giữ 1 chỗ trong sức chứa Hub" />
          <DetailRow label="Hạn check-in" value={arrivalTime ? formatTime(new Date(arrival + PARKING_RULES.capacityGraceMinutes * MINUTE).toISOString()) : '—'} />
          <div className="mt-4 space-y-3">
            {openAtHub && tab === 'private' && <Notice tone="warn" title="Bạn đã có đơn tại Hub này">Đơn {openAtHub.reservationId} chưa kết thúc. Hủy đơn đó trước nếu muốn đặt lại.</Notice>}
            {message && <Notice tone="danger" title="Chưa thực hiện được">{message}</Notice>}
            <Button onClick={submit} disabled={!canSubmit} icon={<SquareParking size={18} />}>Xác nhận đặt chỗ đỗ</Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">Chỉ giữ sức chứa của Hub, chưa cấp ô cụ thể và không giữ cổng sạc. Ô được cấp khi bạn check-in tại Hub.</p>
        </Card>

        {current && <ReservationCard reservation={current} now={now} hubName={hubs.find((item) => item.hubId === current.hubId)?.name ?? current.hubId}
          onCheckIn={() => startCheckIn(current)} onCancel={() => cancel(current)} />}

        {otherOpen.length > 0 && <Card>
          <CardTitle title="Đơn khác đang mở" />
          <ul className="space-y-2 text-sm">{otherOpen.map((item) => <li key={item.reservationId}>
            <Link to={`/student/parking/${item.reservationId}`} className="font-semibold text-[#087f6a] hover:underline">{item.reservationId}</Link>
            <span className="text-[#5f716c]"> · {item.hubId} · đến {formatTime(item.arrivalTime)}</span>
          </li>)}</ul>
        </Card>}

        <Card>
          <CardTitle title="Bạn dùng xe chung?" />
          <p className="text-sm leading-6 text-[#5f716c]">Chọn "Xe dùng chung" và liên kết hành trình đang hoạt động. Chỗ đỗ được kiểm tra lại khi trả xe.</p>
        </Card>
      </aside>
    </div>
  </div>
}

function ReservationCard({ reservation, now, hubName, onCheckIn, onCancel }: {
  reservation: ParkingReservation; now: number; hubName: string; onCheckIn: () => void; onCancel: () => void
}) {
  const holdUntil = `${formatTime(reservation.expiresAt)} · ${formatShortDate(reservation.expiresAt)}`
  const detailLink = <Link to={`/student/parking/${reservation.reservationId}`} className="mt-4 block rounded-lg bg-[#087f6a] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#066b59]">Xem check-in</Link>

  switch (reservation.status) {
    case 'HELD':
      return <Card tone="success">
        <CardTitle title="Xác nhận sau khi đặt" subtitle={`Đặt lúc ${formatTime(reservation.createdAt)}`} />
        <StatusTag tone="success">Đã giữ chỗ · chờ check-in</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub nhận chỗ" value={hubName} />
        <DetailRow label="Giữ đến" value={holdUntil} />
        <p className="mt-3 text-sm leading-6 text-[#17332f]">Giữ chỗ đến {formatTime(reservation.expiresAt)} (còn <span className="font-semibold tabular-nums">{formatCountdown(new Date(reservation.expiresAt).getTime() - now)}</span>). Quá hạn chưa check-in, hệ thống tự hủy và trả chỗ. Khi check-in, hệ thống kiểm tra lại cảm biến rồi mới cấp ô.</p>
        <div className="mt-4 space-y-3">
          <Button onClick={onCheckIn} icon={<SquareParking size={18} />}>Check-in khi đến Hub</Button>
          <Button variant="danger" onClick={onCancel}>Hủy đặt chỗ</Button>
        </div>
      </Card>
    case 'SLOT_ASSIGNED':
      return <Card tone="success">
        <CardTitle title="Đã cấp ô đỗ" subtitle="Chờ cảm biến xác nhận xe vào ô" />
        <StatusTag tone="success">Đã cấp ô {reservation.slotId} · chờ cảm biến</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub nhận chỗ" value={hubName} />
        <DetailRow label="Đỗ vào ô trước" value={formatTime(reservation.slotHoldExpiresAt)} />
        {detailLink}
      </Card>
    case 'ARRIVED':
      return <Card tone="success">
        <CardTitle title="Đã đến Hub" subtitle="Cảm biến đã xác nhận xe trong ô" />
        <StatusTag tone="success">Đang đỗ · ô {reservation.slotId}</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub nhận chỗ" value={hubName} />
        {detailLink}
      </Card>
    case 'CHECK_IN_FAILED':
      return <Card tone="danger">
        <CardTitle title="Check-in thất bại" subtitle={`Lúc ${formatTime(reservation.checkedInAt)}`} />
        <StatusTag tone="danger">Check-in thất bại · đã trả chỗ</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Chỗ giữ" value="Đã trả lại Hub" />
        {detailLink}
      </Card>
    case 'EXPIRED':
      return <Card tone="warn">
        <CardTitle title="Đặt chỗ đã hết hạn" subtitle={`Cập nhật lúc ${formatTime(reservation.expiresAt)}`} />
        <StatusTag tone="warn">Hết hạn · đã trả chỗ</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub nhận chỗ" value={hubName} />
        <DetailRow label="Giữ đến" value={holdUntil} />
        <p className="mt-3 text-sm leading-6 text-[#17332f]">Bạn chưa check-in trước {formatTime(reservation.expiresAt)} nên hệ thống đã hủy đơn và trả chỗ về Hub. Muốn đỗ xe, bạn đặt lại với giờ đến mới ở form bên trái.</p>
      </Card>
    case 'CANCELLED':
      return <Card tone="neutral">
        <CardTitle title="Đã hủy đặt chỗ" />
        <StatusTag tone="neutral">Đã hủy · đã trả chỗ</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub" value={hubName} />
        <p className="mt-3 text-sm leading-6 text-[#5f716c]">Chỗ giữ đã được trả về Hub. Bạn có thể đặt lại ở form bên trái.</p>
      </Card>
    case 'COMPLETED':
      return <Card tone="neutral">
        <CardTitle title="Đã rời bãi" />
        <StatusTag tone="neutral">Hoàn tất</StatusTag>
        <BigCode>{reservation.reservationId}</BigCode>
        <DetailRow label="Hub" value={hubName} />
        <DetailRow label="Ô đã dùng" value={reservation.slotId ?? '—'} />
      </Card>
  }
}
