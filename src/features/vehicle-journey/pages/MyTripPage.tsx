// "Hành trình của tôi": the student's latest booking in whatever state it is in.
//   RESERVED  -> ticket with countdown and QR pickup
//   EXPIRED   -> VJ-03f Phiếu đặt xe đã hết hạn (Figma 161:202)
//   IN_USE    -> VJ-04 Hành trình đang diễn ra (Figma 68:2), VJ-05 Hub full (Figma 68:295)
//   COMPLETED -> trip summary with the return outcome
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, CircleAlert, Info, LockKeyhole, LockKeyholeOpen, QrCode, TriangleAlert } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { estimatedRangeKm, isReservable, JOURNEY_RULES } from '../../../store/vehicleJourneySlice'
import { hubFreeSlots } from '../../../store/storeUtils'
import type { Hub, Vehicle, VehicleReservation } from '../../../types'
import { Button, Card, CardTitle, DemoButton, DemoPanel, DetailRow, Notice, PageHeader, StatusTag, inputClass } from '../../../components/shared/ui'
import { formatCountdown, formatDateTime, formatShortDate, formatTime, hubLabel } from '../../../lib/format'
import { vehicleStatusView, vehicleTypeLabel } from '../../../lib/labels'
import { DEMO_STUDENT_ID } from '../../../lib/demoUser'
import { useNow } from '../../../lib/useNow'
import { HoldTimeCard, SelectedVehicleCard, TicketCode } from '../components/JourneyCards'
import { formatDistance, formatElapsed, hubGeo, returnErrorText } from '../journey'

const ISSUE_TYPES = ['Xe không khởi động được', 'Phanh hoặc lốp có vấn đề', 'Pin tụt nhanh bất thường', 'Khóa xe không hoạt động']

function ReservedView({ reservation, vehicle, hub, now }: { reservation: VehicleReservation; vehicle: Vehicle; hub?: Hub; now: number }) {
  const navigate = useNavigate()
  const cancel = useMobilityStore((s) => s.cancelVehicleReservation)
  const remaining = new Date(reservation.expiresAt).getTime() - now
  const urgent = remaining < 3 * 60 * 1000
  return <div className="space-y-6">
    <PageHeader now={now} eyebrow={`Hành trình của tôi / Phiếu ${reservation.reservationId}`} title="Xe đang được giữ cho bạn"
      subtitle={`Đến ${hub?.name ?? 'Hub'} và quét mã QR trên xe trước ${formatTime(reservation.expiresAt)} để nhận xe.`} />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <SelectedVehicleCard title="Xe trong phiếu đặt" subtitle="Xe đang được giữ, người khác không thể đặt" vehicle={vehicle} hub={hub} tag={{ tone: 'info', label: 'Đã đặt' }} />
        <HoldTimeCard subtitle="Chính sách giữ xe áp dụng cho đơn đặt trước này" tone={urgent ? 'warn' : 'active'} caption="còn lại để nhận xe"
          remainingMs={remaining} startedAt={reservation.createdAt} expiresAt={reservation.expiresAt} hub={hub}
          message={urgent ? `Sắp hết thời gian giữ xe. Quá ${formatTime(reservation.expiresAt)} phiếu sẽ tự hủy và xe trở lại trạng thái sẵn sàng.`
            : `Xe được giữ đến ${formatTime(reservation.expiresAt)}. Tại Hub, mở camera và quét mã QR trên thân xe để nhận xe.`} />
      </div>
      <aside className="min-w-0 space-y-6">
        <Card tone="success">
          <CardTitle title="Đặt xe thành công" subtitle="Phiếu đặt xe của bạn" />
          <StatusTag tone="success">Đã giữ xe</StatusTag>
          <TicketCode code={reservation.reservationId} caption="Mã đặt xe / mã QR nhận xe" />
          <div className="mt-4">
            <DetailRow label="Đồng hồ đếm ngược" value={<span className={urgent ? 'text-[#946013]' : ''}>{formatCountdown(remaining)}</span>} />
            <DetailRow label="Trạng thái xe" value="Reserved" />
          </div>
          <div className="mt-4 space-y-3">
            <Button icon={<QrCode size={16} />} onClick={() => navigate('/student/trips/pickup')}>Quét mã QR để nhận xe</Button>
            <Button variant="danger" onClick={() => cancel(DEMO_STUDENT_ID, reservation.reservationId)}>Hủy đặt xe</Button>
          </div>
        </Card>
        <Card>
          <CardTitle title="Nếu đến muộn" />
          <p className="text-sm leading-6 text-[#5f716c]">Mỗi phiếu chỉ giữ xe {JOURNEY_RULES.holdMinutes} phút để xe không bị chiếm khi không dùng. Hết hạn, hệ thống hủy phiếu và gửi thông báo cho bạn; bạn có thể đặt lại nếu xe vẫn sẵn sàng.</p>
        </Card>
      </aside>
    </div>
  </div>
}

function ExpiredView({ reservation, vehicle, hub, now }: { reservation: VehicleReservation; vehicle: Vehicle; hub?: Hub; now: number }) {
  const navigate = useNavigate()
  const reserve = useMobilityStore((s) => s.reserveSharedVehicle)
  const [error, setError] = useState<string>()
  const canRebook = isReservable(vehicle)
  const rebook = () => {
    const result = reserve(DEMO_STUDENT_ID, vehicle.vehicleId)
    if (!result.ok) setError(result.reason === 'ALREADY_RESERVED' ? 'Xe vừa được người khác đặt. Hãy chọn xe khác tại Hub.' : 'Xe không còn đủ điều kiện để đặt lại.')
  }
  return <div className="space-y-6">
    <PageHeader now={now} eyebrow={`Hành trình của tôi / Phiếu ${reservation.reservationId}`} title="Phiếu đặt xe đã hết hạn"
      subtitle={`Bạn chưa nhận xe trong ${JOURNEY_RULES.holdMinutes} phút giữ chỗ nên hệ thống đã hủy phiếu và trả xe về trạng thái sẵn sàng.`} />
    {error && <Notice tone="danger" title="Không đặt lại được">{error}</Notice>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <SelectedVehicleCard title="Xe trong phiếu đã hủy" subtitle="Xe đã được nhả, người khác có thể đặt" vehicle={vehicle} hub={hub}
          tag={{ tone: vehicle.status === 'AVAILABLE' ? 'success' : 'neutral', label: vehicleStatusView[vehicle.status].label }} />
        <HoldTimeCard subtitle="Chính sách giữ xe áp dụng cho đơn đặt trước này" tone="warn" caption="đã hết thời gian giữ" remainingMs={0}
          startedAt={reservation.createdAt} expiresAt={reservation.expiresAt} hub={hub}
          message={`Thời gian giữ xe kết thúc lúc ${formatTime(reservation.expiresAt)}. Phiếu ${reservation.reservationId} chuyển sang EXPIRED và xe ${vehicle.vehicleId} trở lại trạng thái AVAILABLE tại ${hub?.name ?? 'Hub'}.`} />
        <div className="flex gap-3 rounded-2xl bg-[#fff4df] p-5 text-[#946013]">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div><p className="text-sm font-semibold">Muốn dùng lại xe này?</p><p className="mt-1 text-sm leading-6">{canRebook
            ? `Nếu chưa ai đặt, xe ${vehicle.vehicleId} vẫn ở Hub ${vehicle.hubId}. Bạn có thể đặt lại, hệ thống sẽ giữ xe thêm ${JOURNEY_RULES.holdMinutes} phút mới.`
            : `Xe ${vehicle.vehicleId} hiện không thể đặt lại (${vehicleStatusView[vehicle.status].label.toLowerCase()}). Hãy chọn một xe khác.`}</p></div>
        </div>
      </div>
      <aside className="min-w-0 space-y-6">
        <Card tone="warn">
          <CardTitle title="Phiếu đặt xe đã hết hạn" subtitle={`Cập nhật lúc ${formatTime(reservation.expiresAt)}`} />
          <StatusTag tone="warn">Hết hạn · đã trả xe</StatusTag>
          <div className="mt-3">
            <DetailRow label="Mã phiếu" value={reservation.reservationId} />
            <DetailRow label="Xe" value={`${vehicle.vehicleId} · Hub ${reservation.hubId}`} />
            <DetailRow label="Hạn nhận xe" value={`${formatTime(reservation.expiresAt)} · ${formatShortDate(reservation.expiresAt)}`} />
            <DetailRow label="Trạng thái phiếu" value="EXPIRED" />
          </div>
          <div className="mt-4 space-y-3">
            <Button icon={<Check size={16} />} disabled={!canRebook} onClick={rebook}>Đặt lại xe {vehicle.vehicleId}</Button>
            <Button variant="outline" onClick={() => navigate(`/student/vehicles?hubId=${reservation.hubId}`)}>Xem xe khác tại Hub</Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">Nếu bạn quét QR đúng lúc phiếu hết hạn, hệ thống chỉ chấp nhận một kết quả: nhận xe thành công hoặc báo hết hạn.</p>
        </Card>
        <Card>
          <CardTitle title="Vì sao phiếu bị hủy?" />
          <p className="text-sm leading-6 text-[#5f716c]">Mỗi phiếu chỉ giữ xe {JOURNEY_RULES.holdMinutes} phút để xe không bị chiếm khi không dùng. Hệ thống gửi thông báo cho bạn ngay khi phiếu hết hạn.</p>
        </Card>
      </aside>
    </div>
  </div>
}

function ActiveTripView({ reservation, vehicle, now }: { reservation: VehicleReservation; vehicle: Vehicle; now: number }) {
  const hubs = useMobilityStore((s) => s.hubs)
  const returnVehicle = useMobilityStore((s) => s.returnSharedVehicle)
  const toggleLock = useMobilityStore((s) => s.toggleTripLock)
  const reportIssue = useMobilityStore((s) => s.reportTripIssue)
  const setTelemetry = useMobilityStore((s) => s.setVehicleTelemetry)
  const [destinationId, setDestinationId] = useState(reservation.hubId)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issue, setIssue] = useState(ISSUE_TYPES[0])
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; title: string; body?: string }>()

  const origin = hubs.find((hub) => hub.hubId === reservation.hubId)
  const destination = hubs.find((hub) => hub.hubId === destinationId)
  const destinationFull = !destination || hubFreeSlots(destination) <= 0
  const byDistance = [...hubs].sort((a, b) => (hubGeo[a.hubId]?.distance ?? 9e9) - (hubGeo[b.hubId]?.distance ?? 9e9))
  const nearestFree = byDistance.find((hub) => hub.hubId !== destinationId && hubFreeSlots(hub) > 0)
  const elapsed = now - new Date(reservation.pickedUpAt ?? now).getTime()
  const drop = Math.max(0, (reservation.startBattery ?? vehicle.battery) - vehicle.battery)

  const finish = () => {
    const result = returnVehicle(DEMO_STUDENT_ID, reservation.reservationId, destinationId)
    if (!result.ok) setMessage({ tone: 'danger', title: 'Chưa thể trả xe', body: returnErrorText[result.reason] })
  }
  const sendIssue = () => {
    const incidentId = reportIssue(DEMO_STUDENT_ID, reservation.reservationId, issue)
    setIssueOpen(false)
    if (incidentId) setMessage({ tone: 'success', title: `Đã gửi báo cáo ${incidentId}`, body: 'Operator và đội kỹ thuật đã nhận thông tin. Bạn vẫn có thể tiếp tục hoặc trả xe tại Hub gần nhất.' })
  }

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow={destinationFull ? 'Hành trình của tôi / Trả xe' : 'Hành trình của tôi / Đang di chuyển'}
      title={destinationFull ? 'Kết thúc hành trình' : 'Hành trình đang diễn ra'}
      subtitle={destinationFull ? 'Hub đích bạn chọn đã hết chỗ đỗ nên chưa thể trả xe.' : 'Xe đang ở trạng thái In-Use. Bạn có thể tạm khóa xe, báo sự cố hoặc kết thúc hành trình tại Hub đích.'} />
    {message && <Notice tone={message.tone} title={message.title}>{message.body}</Notice>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardTitle title="Trạng thái hành trình" subtitle="Mức pin được cập nhật gần thời gian thực (5 giây/lần)" />
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#e6f4ef] p-5">
            <div><p className="text-sm font-medium text-[#087f6a]">Đang thuê</p><p className="mt-1 text-5xl font-semibold tabular-nums text-[#087f6a]">{formatElapsed(elapsed)}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase text-[#087f6a]">{reservation.locked ? 'In-use · tạm khóa' : 'In-use · đang di chuyển'}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[['Mã xe', vehicle.vehicleId, vehicleTypeLabel(vehicle)], ['Pin hiện tại', `${vehicle.battery}%`, `Giảm ${drop}% từ lúc nhận xe`], ['Quãng đường còn lại', `~${estimatedRangeKm(vehicle)} km`, 'Ước tính theo mức pin']]
              .map(([label, value, hint]) => <div key={label} className="rounded-xl bg-[#eef3f1] p-4">
                <p className="text-xs text-[#5f716c]">{label}</p><p className={`mt-1 text-xl font-semibold ${label === 'Pin hiện tại' && vehicle.battery <= JOURNEY_RULES.minBattery ? 'text-[#946013]' : 'text-[#17332f]'}`}>{value}</p><p className="mt-1 text-xs text-[#5f716c]">{hint}</p>
              </div>)}
          </div>
          <div className="mt-4">
            <DetailRow label="Hub xuất phát" value={hubLabel(origin)} />
            <DetailRow label="Nhận xe lúc" value={reservation.pickedUpAt ? formatDateTime(reservation.pickedUpAt) : '—'} />
            <DetailRow label="Mã đặt xe" value={reservation.reservationId} />
          </div>
        </Card>

        <Card>
          <CardTitle title="Thao tác khi đi đường" subtitle="Dùng khi cần dừng giữa chặng hoặc xe gặp vấn đề" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Button variant="outline" icon={reservation.locked ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={16} />} onClick={() => toggleLock(DEMO_STUDENT_ID, reservation.reservationId)}>{reservation.locked ? 'Mở khóa xe' : 'Tạm khóa xe'}</Button>
              <p className="mt-2 text-xs text-[#5f716c]">{reservation.locked ? 'Xe đang tạm khóa. Mở khóa để tiếp tục di chuyển.' : 'Dừng ngắn để mua đồ. Hành trình vẫn được tính giờ.'}</p>
            </div>
            <div>
              <button type="button" onClick={() => setIssueOpen(!issueOpen)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#e9c98f] bg-white px-4 py-3 text-sm font-semibold text-[#946013] hover:bg-[#fffaf0]"><TriangleAlert size={16} /> Báo sự cố</button>
              <p className="mt-2 text-xs text-[#5f716c]">Gửi báo cáo cho Operator và đội kỹ thuật.</p>
            </div>
          </div>
          {issueOpen && <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-[#fffaf0] p-4">
            <div className="min-w-0 flex-1"><label htmlFor="issue-type" className="mb-2 block text-sm font-medium text-[#17332f]">Vấn đề gặp phải</label>
              <select id="issue-type" value={issue} onChange={(event) => setIssue(event.target.value)} className={inputClass}>{ISSUE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <button type="button" onClick={sendIssue} className="rounded-lg bg-[#946013] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7c500f]">Gửi báo cáo</button>
          </div>}
        </Card>

        <div className="flex gap-3 rounded-2xl bg-[#e6f4ef] p-5 text-[#087f6a]">
          <Info size={18} className="mt-0.5 shrink-0" />
          <div><p className="text-sm font-semibold">Trước khi trả xe</p><p className="mt-1 text-sm leading-6">Đưa xe vào đúng vị trí đỗ tại Hub đích và khóa chốt an toàn trước khi bấm Trả xe.</p></div>
        </div>

        <DemoPanel title="Bảng mô phỏng telemetry xe">
          <DemoButton onClick={() => setTelemetry(vehicle.vehicleId, { battery: 15 })}>Pin xe còn 15%</DemoButton>
          <DemoButton onClick={() => setTelemetry(vehicle.vehicleId, { faultCode: 'ERR-MOTOR-02' })}>Xe báo lỗi ERR-MOTOR-02</DemoButton>
          <DemoButton onClick={() => setTelemetry(vehicle.vehicleId, { heartbeatLost: true })}>Mất heartbeat</DemoButton>
          <DemoButton onClick={() => setTelemetry(vehicle.vehicleId, { faultCode: null, heartbeatLost: false })}>Telemetry bình thường</DemoButton>
        </DemoPanel>
      </div>

      <aside className="min-w-0 space-y-6">
        <Card tone="success">
          <CardTitle title="Kết thúc hành trình" subtitle="Chọn Hub đích để trả xe" />
          <label htmlFor="destination-hub" className="mb-2 block text-sm font-medium text-[#17332f]">Hub đích</label>
          <select id="destination-hub" value={destinationId} onChange={(event) => { setDestinationId(event.target.value); setMessage(undefined) }}
            className={`${inputClass} ${destinationFull ? 'border-[#c9a15a]' : ''}`}>
            {hubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hubLabel(hub)}</option>)}
          </select>
          {destinationFull
            ? <div className="mt-4 flex gap-3 rounded-xl bg-[#fff4df] p-4 text-[#946013]"><CircleAlert size={18} className="mt-0.5 shrink-0" /><div><p className="text-sm font-semibold">Hub này đã hết chỗ</p><p className="mt-1 text-sm leading-6">Hub này đã hết chỗ{nearestFree ? `, vui lòng chọn Hub ${nearestFree.name} (cách ${formatDistance(hubGeo[nearestFree.hubId]?.distance)})` : ''}.</p></div></div>
            : <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#087f6a]"><Check size={16} /> {destination?.name} hiện còn {destination ? hubFreeSlots(destination) : 0} chỗ đỗ trống</p>}
          <div className="mt-4">
            <DetailRow label="Hub xuất phát" value={origin?.name ?? '—'} />
            <DetailRow label="Thời gian di chuyển" value={formatElapsed(elapsed)} />
            <DetailRow label="Pin tiêu hao ước tính" value={`${drop}%`} />
          </div>
          <Button className="mt-4" icon={<Check size={16} />} disabled={destinationFull} onClick={finish}>Trả xe & Kết thúc</Button>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">{destinationFull ? 'Nút Trả xe bị khóa cho đến khi bạn chọn Hub còn chỗ đỗ.' : `Sau khi trả xe, xe chuyển sang Sẵn sàng nếu pin trên ${JOURNEY_RULES.minBattery}%, ngược lại chuyển sang Chờ sạc.`}</p>
        </Card>
        <Card>
          <CardTitle title="Chỗ đỗ trống tại các Hub" subtitle="Chọn Hub còn chỗ để trả xe" />
          {byDistance.map((hub) => <DetailRow key={hub.hubId} label={`${hub.name} · ${hub.hubId}${hubGeo[hub.hubId] ? ` (cách ${formatDistance(hubGeo[hub.hubId].distance)})` : ''}`}
            value={hubFreeSlots(hub) > 0 ? `${hubFreeSlots(hub)} chỗ trống` : 'Đã đầy · 0 chỗ'} />)}
        </Card>
      </aside>
    </div>
  </div>
}

const outcomeText = (reservation: VehicleReservation, chargingId?: string) => {
  switch (reservation.returnOutcome) {
    case 'PENDING_CHARGING': return { tone: 'warn' as const, title: 'Xe chuyển sang Chờ sạc', body: `Pin còn từ ${JOURNEY_RULES.minBattery}% trở xuống nên hệ thống đã tạo yêu cầu sạc${chargingId ? ` ${chargingId}` : ''} và đưa vào hàng đợi.` }
    case 'UNAVAILABLE': return { tone: 'danger' as const, title: 'Xe được chuyển sang bảo trì', body: 'Xe báo lỗi khi trả nên không thể cho thuê tiếp. Sự cố đã được gửi đến Operator.' }
    case 'DISCONNECTED': return { tone: 'danger' as const, title: 'Xe mất kết nối', body: 'Hệ thống không nhận được heartbeat của xe khi trả. Operator sẽ kiểm tra lại xe.' }
    default: return { tone: 'success' as const, title: 'Xe đã sẵn sàng cho người tiếp theo', body: 'Cảm ơn bạn đã trả xe đúng nơi quy định.' }
  }
}

export default function MyTripPage() {
  const now = useNow()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const reservations = useMobilityStore((s) => s.vehicleReservations)
  const chargingRequests = useMobilityStore((s) => s.chargingRequests)
  const latest = reservations.filter((item) => item.studentId === DEMO_STUDENT_ID).at(-1)
  const vehicle = vehicles.find((item) => item.vehicleId === latest?.vehicleId)

  if (!latest || !vehicle) {
    return <div className="space-y-6">
      <PageHeader now={now} eyebrow="Hành trình của tôi" title="Bạn chưa có hành trình nào" subtitle="Tìm một xe sẵn sàng tại Hub gần bạn để bắt đầu." />
      <Card><CardTitle title="Chưa có phiếu đặt xe" subtitle="Đặt trước xe để được giữ xe trong 15 phút." />
        <Link to="/student/vehicles" className="inline-flex rounded-lg bg-[#087f6a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b59]">Tìm xe & Hub</Link></Card>
    </div>
  }
  const hub = hubs.find((item) => item.hubId === latest.hubId)
  if (latest.status === 'RESERVED') return <ReservedView reservation={latest} vehicle={vehicle} hub={hub} now={now} />
  if (latest.status === 'EXPIRED') return <ExpiredView reservation={latest} vehicle={vehicle} hub={hub} now={now} />
  if (latest.status === 'IN_USE') return <ActiveTripView reservation={latest} vehicle={vehicle} now={now} />

  const returnHub = hubs.find((item) => item.hubId === latest.returnHubId)
  const charging = chargingRequests.find((request) => request.vehicleId === vehicle.vehicleId && request.source === 'SYSTEM' && request.createdAt >= (latest.returnedAt ?? ''))
  const outcome = outcomeText(latest, charging?.requestId)
  return <div className="space-y-6">
    <PageHeader now={now} eyebrow={`Hành trình của tôi / Phiếu ${latest.reservationId}`}
      title={latest.status === 'COMPLETED' ? 'Đã kết thúc hành trình' : 'Đã hủy phiếu đặt xe'}
      subtitle={latest.status === 'COMPLETED' ? `Bạn đã trả xe ${vehicle.vehicleId} tại ${returnHub?.name ?? 'Hub'}.` : `Xe ${vehicle.vehicleId} đã được nhả cho người khác đặt.`} />
    {latest.status === 'COMPLETED' && <Notice tone={outcome.tone} title={outcome.title}>{outcome.body}</Notice>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <CardTitle title="Tóm tắt" />
        <DetailRow label="Mã phiếu" value={latest.reservationId} />
        <DetailRow label="Xe" value={`${vehicle.vehicleId} · ${vehicleTypeLabel(vehicle)}`} />
        <DetailRow label="Hub nhận xe" value={hubLabel(hub)} />
        {latest.status === 'COMPLETED' && <>
          <DetailRow label="Nhận xe lúc" value={latest.pickedUpAt ? formatDateTime(latest.pickedUpAt) : '—'} />
          <DetailRow label="Trả xe lúc" value={latest.returnedAt ? formatDateTime(latest.returnedAt) : '—'} />
          <DetailRow label="Thời gian thuê" value={latest.pickedUpAt && latest.returnedAt ? formatElapsed(new Date(latest.returnedAt).getTime() - new Date(latest.pickedUpAt).getTime()) : '—'} />
          <DetailRow label="Hub trả xe" value={hubLabel(returnHub)} />
          <DetailRow label="Trạng thái xe sau khi trả" value={vehicleStatusView[latest.returnOutcome ?? vehicle.status].label} />
        </>}
      </Card>
      <Card tone="success">
        <CardTitle title="Tiếp tục di chuyển?" subtitle="Bạn có thể đặt xe mới ngay." />
        <Link to="/student/vehicles" className="inline-flex w-full justify-center rounded-lg bg-[#087f6a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#066b59]">Tìm xe mới</Link>
      </Card>
    </div>
  </div>
}
