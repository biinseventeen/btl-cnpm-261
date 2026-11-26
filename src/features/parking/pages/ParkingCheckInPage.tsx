// PK-01e (Figma 145:2) and PK-01f (145:247): check-in result, slot map and sensor wait.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MapPin, SquareParking } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { availableCapacity } from '../../../store/parkingSlice'
import type { ParkingReservation } from '../../../types'
import SlotGrid from '../components/SlotGrid'
import { DEMO_STUDENT_ID } from '../constants'
import { checkInErrorMessage, failureMessage, formatCountdown, formatDateTime, formatShortDate, formatTime, slotLocation } from '../format'
import { useNow } from '../useNow'
import { BigCode, Button, Card, CardTitle, DetailRow, LifecycleCard, Notice, PageHeader, PolicyNote, StatusTag } from '../ui'

export default function ParkingCheckInPage() {
  const { reservationId = '' } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const hubs = useMobilityStore((s) => s.hubs)
  const allSlots = useMobilityStore((s) => s.parkingSlots)
  const reservation = useMobilityStore((s) => s.parkingReservations.find((item) => item.reservationId === reservationId))
  const checkIn = useMobilityStore((s) => s.checkInParking)
  const cancelReservation = useMobilityStore((s) => s.cancelParkingReservation)
  const checkOut = useMobilityStore((s) => s.checkOutParking)
  const reportSensor = useMobilityStore((s) => s.reportSlotSensor)
  const [message, setMessage] = useState<string>()

  if (!reservation || reservation.studentId !== DEMO_STUDENT_ID) {
    return <Card><CardTitle title="Không tìm thấy đơn đặt chỗ" subtitle={`Đơn ${reservationId} không tồn tại hoặc không thuộc tài khoản của bạn.`} />
      <Link to="/student/parking" className="text-sm font-semibold text-[#087f6a] hover:underline">Quay lại đặt chỗ</Link></Card>
  }

  const hub = hubs.find((item) => item.hubId === reservation.hubId)
  const hubName = hub?.name ?? reservation.hubId
  const slots = allSlots.filter((slot) => slot.hubId === reservation.hubId)
  const mySlotId = reservation.status === 'SLOT_ASSIGNED' || reservation.status === 'ARRIVED' ? reservation.slotId : undefined
  const zones = [...new Set(slots.map((slot) => slot.slotId.split('-')[0]))].join(', ')
  const otherFree = slots.filter((slot) => slot.slotId !== mySlotId && slot.status === 'FREE' && slot.sensorStatus === 'ONLINE').map((slot) => slot.slotId)
  const occupiedCount = slots.filter((slot) => slot.status === 'OCCUPIED' || slot.status === 'ASSIGNED').length
  const blockedCount = slots.filter((slot) => slot.status === 'UNAVAILABLE' || (slot.status === 'FREE' && slot.sensorStatus !== 'ONLINE')).length
  const alternatives = hubs.filter((item) => item.hubId !== reservation.hubId && availableCapacity(item) > 0)
    .sort((a, b) => availableCapacity(b) - availableCapacity(a)).slice(0, 2)

  const retryCheckIn = () => {
    const result = checkIn(DEMO_STUDENT_ID, reservation.reservationId)
    setMessage(result.ok || result.reason === 'NO_PHYSICAL_SLOT' || result.reason === 'SENSOR_UNAVAILABLE' ? undefined : checkInErrorMessage[result.reason])
  }
  const cancel = () => {
    const result = cancelReservation(DEMO_STUDENT_ID, reservation.reservationId)
    setMessage(result.ok ? undefined : 'Không hủy được: đơn đã đổi trạng thái.')
  }
  const leave = () => {
    const result = checkOut(DEMO_STUDENT_ID, reservation.reservationId)
    setMessage(result.ok ? undefined : 'Không check-out được: đơn đã đổi trạng thái.')
  }
  const showSlot = () => document.getElementById(`slot-${reservation.slotId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const subtitle: Record<ParkingReservation['status'], string> = {
    HELD: `Đơn ${reservation.reservationId} đang giữ chỗ, chưa được cấp ô.`,
    SLOT_ASSIGNED: `Hệ thống đã kiểm tra lại cảm biến và cấp một ô trống cho đơn ${reservation.reservationId}.`,
    ARRIVED: `Cảm biến đã xác nhận xe của bạn trong ô ${reservation.slotId}.`,
    CHECK_IN_FAILED: `Không cấp được ô cho đơn ${reservation.reservationId}. Chỗ giữ của bạn đã được trả lại.`,
    CANCELLED: `Đơn ${reservation.reservationId} đã bị hủy.`,
    EXPIRED: `Đơn ${reservation.reservationId} đã hết hạn.`,
    COMPLETED: `Đơn ${reservation.reservationId} đã hoàn tất.`,
  }

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Chỗ đỗ / Check-in tại Hub" title={`Check-in tại ${hubName}`} subtitle={subtitle[reservation.status]} />

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title={`Sơ đồ ô đỗ · ${hubName}, khu ${zones}`} subtitle={`Trạng thái theo cảm biến lúc ${formatTime(new Date(now).toISOString())} · ô được cấp cho bạn tô đậm`} />
          <SlotGrid slots={slots} mySlotId={mySlotId} />
          <div className="mt-5">
            {reservation.status === 'SLOT_ASSIGNED' && <Notice tone="success" title={`Ô ${reservation.slotId} đang được giữ cho bạn`}>
              Ô chuyển sang trạng thái Đã cấp đến {formatTime(reservation.slotHoldExpiresAt)}.{otherFree.length > 0 && ` ${otherFree.length === 1 ? 'Ô' : 'Các ô'} ${otherFree.join(', ')} còn trống nhưng chưa cấp cho ai.`}
            </Notice>}
            {reservation.status === 'ARRIVED' && <Notice tone="success" title="Check-in hoàn tất">Cảm biến thấy xe trong ô {reservation.slotId}. Khi bạn rời bãi, ô được trả lại cho Hub.</Notice>}
            {reservation.status === 'CHECK_IN_FAILED' && <Notice tone="danger" title={reservation.failureReason ? failureMessage[reservation.failureReason] : 'Không cấp được ô'}>
              {occupiedCount} ô đang có xe, {blockedCount} ô bảo trì hoặc mất tín hiệu cảm biến. Chưa có ô nào được cấp cho bạn, nhân viên vận hành đã được thông báo.
            </Notice>}
            {reservation.status === 'HELD' && <Notice tone="warn" title="Chưa được cấp ô">
              {reservation.checkedInAt ? 'Ô giữ trước đó đã được trả lại vì quá 10 phút cảm biến chưa thấy xe vào. Chỗ giữ trong sức chứa Hub vẫn còn, bạn check-in lại để nhận ô mới.' : 'Bấm check-in khi bạn đã tới Hub.'}
            </Notice>}
          </div>
        </Card>
        <LifecycleCard status={reservation.status} />
        <PolicyNote arrivalTime={reservation.arrivalTime} expiresAt={reservation.expiresAt} />
      </div>

      <aside className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Đơn đặt chỗ" />
          <DetailRow label="Mã đơn" value={reservation.reservationId} />
          <DetailRow label="Loại sử dụng" value={`Xe cá nhân · ${reservation.evId ?? '—'}`} />
          <DetailRow label="Ngày, giờ đến" value={formatDateTime(reservation.arrivalTime)} />
          <DetailRow label="Giữ chỗ" value={`${formatTime(reservation.arrivalTime)} – ${formatTime(reservation.expiresAt)}`} />
          <DetailRow label="Check-in lúc" value={formatTime(reservation.checkedInAt)} />
        </Card>

        {message && <Notice tone="danger" title="Chưa thực hiện được">{message}</Notice>}

        {reservation.status === 'SLOT_ASSIGNED' && <Card tone="success">
          <CardTitle title="Đã cấp ô đỗ" subtitle="Chờ cảm biến xác nhận xe vào ô" />
          <StatusTag tone="success">Đã cấp ô · chờ cảm biến</StatusTag>
          <BigCode>Ô {reservation.slotId}</BigCode>
          <DetailRow label="Vị trí" value={slotLocation(reservation.slotId!)} />
          <DetailRow label="Đỗ vào ô trước" value={`${formatTime(reservation.slotHoldExpiresAt)} · ${formatShortDate(reservation.slotHoldExpiresAt!)}`} />
          <p className="mt-3 text-sm leading-6 text-[#17332f]">Ô {reservation.slotId} được giữ cho bạn 10 phút (còn <span className="font-semibold tabular-nums">{formatCountdown(new Date(reservation.slotHoldExpiresAt!).getTime() - now)}</span>). Khi cảm biến thấy xe trong ô, check-in hoàn tất tự động. Quá 10 phút chưa có xe, ô được trả lại và đơn quay về trạng thái giữ chỗ nếu còn hạn.</p>
          <div className="mt-4 space-y-3">
            <Button onClick={showSlot} icon={<MapPin size={18} />}>Chỉ đường tới ô {reservation.slotId}</Button>
            <Button variant="danger" onClick={cancel}>Hủy đặt chỗ</Button>
          </div>
        </Card>}

        {reservation.status === 'ARRIVED' && <Card tone="success">
          <CardTitle title="Đã đến Hub" subtitle="Cảm biến đã xác nhận xe trong ô" />
          <StatusTag tone="success">Đã đến · đang đỗ</StatusTag>
          <BigCode>Ô {reservation.slotId}</BigCode>
          <DetailRow label="Vị trí" value={slotLocation(reservation.slotId!)} />
          <div className="mt-4"><Button variant="outline" onClick={leave}>Rời bãi (check-out)</Button></div>
        </Card>}

        {reservation.status === 'CHECK_IN_FAILED' && <Card tone="danger">
          <CardTitle title="Check-in thất bại" subtitle={`${reservation.failureReason ? failureMessage[reservation.failureReason] : 'Không cấp được ô'} lúc ${formatTime(reservation.checkedInAt)}`} />
          <StatusTag tone="danger">Check-in thất bại · đã trả chỗ</StatusTag>
          <BigCode>{reservation.reservationId}</BigCode>
          <DetailRow label="Chỗ giữ" value="Đã trả lại Hub" />
          <DetailRow label="Nhân viên vận hành" value="Đã được báo" />
          <p className="mt-3 text-sm leading-6 text-[#17332f]">
            {alternatives.length ? `Hub còn chỗ: ${alternatives.map((item) => `${item.name}, ${availableCapacity(item)} chỗ trống`).join('; ')}. Bạn cần đặt chỗ mới tại Hub đó.` : 'Hiện không Hub nào còn chỗ trống, bạn thử lại sau.'}
          </p>
          <div className="mt-4 space-y-3">
            {alternatives[0] && <Button onClick={() => navigate(`/student/parking?hubId=${alternatives[0].hubId}`)} icon={<SquareParking size={18} />}>Đặt chỗ tại {alternatives[0].name}</Button>}
            <Button variant="outline" onClick={() => navigate('/student/parking')}>Xem Hub khác</Button>
          </div>
        </Card>}

        {reservation.status === 'HELD' && <Card tone="success">
          <CardTitle title="Đang giữ chỗ" subtitle={`Giữ đến ${formatTime(reservation.expiresAt)} (còn ${formatCountdown(new Date(reservation.expiresAt).getTime() - now)})`} />
          <div className="space-y-3">
            <Button onClick={retryCheckIn} icon={<SquareParking size={18} />}>Check-in khi đến Hub</Button>
            <Button variant="danger" onClick={cancel}>Hủy đặt chỗ</Button>
          </div>
        </Card>}

        {(reservation.status === 'EXPIRED' || reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED') && <Card tone={reservation.status === 'EXPIRED' ? 'warn' : 'neutral'}>
          <CardTitle title={reservation.status === 'EXPIRED' ? 'Đặt chỗ đã hết hạn' : reservation.status === 'CANCELLED' ? 'Đã hủy đặt chỗ' : 'Đã rời bãi'} />
          <p className="text-sm leading-6 text-[#5f716c]">{reservation.status === 'COMPLETED' ? `Ô ${reservation.slotId} đã được trả lại cho Hub.` : 'Chỗ giữ đã được trả về Hub.'}</p>
          <Link to="/student/parking" className="mt-4 block rounded-lg bg-[#087f6a] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#066b59]">Đặt chỗ mới</Link>
        </Card>}

        {(reservation.status === 'SLOT_ASSIGNED' || reservation.status === 'ARRIVED') && <div className="rounded-2xl border border-dashed border-[#c9d6d2] p-4">
          <p className="text-xs font-semibold uppercase text-[#5f716c]">Mô phỏng cảm biến (demo)</p>
          <p className="mt-1 text-xs text-[#5f716c]">Không có cảm biến thật, dùng nút này thay cho tín hiệu từ ô {reservation.slotId}.</p>
          <div className="mt-3">
            {reservation.status === 'SLOT_ASSIGNED'
              ? <Button variant="outline" onClick={() => reportSensor(reservation.slotId!, 'OCCUPIED')}>Cảm biến: xe đã vào ô {reservation.slotId}</Button>
              : <Button variant="outline" onClick={() => reportSensor(reservation.slotId!, 'FREE')}>Cảm biến: xe rời ô {reservation.slotId}</Button>}
          </div>
          <Link to="/operator/parking-slots" className="mt-3 block text-xs font-semibold text-[#087f6a] hover:underline">Mở trang giám sát ô đỗ</Link>
        </div>}
      </aside>
    </div>
  </div>
}
