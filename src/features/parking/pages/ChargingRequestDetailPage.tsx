// PK-02f (Figma 147:2): one charging request, its schedule changes and history.
import { Link, useNavigate, useParams } from 'react-router'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { CANCELLABLE_CHARGING_STATUSES } from '../../../store/parkingSlice'
import HubChargingSnapshot from '../components/HubChargingSnapshot'
import PrivateEvCard from '../components/PrivateEvCard'
import { describeEvent, describeRequest, latestChange } from '../chargingStatus'
import { DEMO_STUDENT_ID } from '../constants'
import { formatShortDate, formatTime } from '../format'
import { useNow } from '../useNow'
import { BigCode, Button, Card, CardTitle, DetailRow, Notice, PageHeader, StatusTag, type Tone } from '../ui'

const dotColor: Record<Tone, string> = {
  success: 'bg-[#087f6a]', warn: 'bg-[#946013]', danger: 'bg-[#b42318]', info: 'bg-[#2b5f8e]', neutral: 'bg-[#8a9a96]',
}

export default function ChargingRequestDetailPage() {
  const { requestId = '' } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const hubs = useMobilityStore((s) => s.hubs)
  const privateEVs = useMobilityStore((s) => s.privateEVs)
  const chargingPoints = useMobilityStore((s) => s.chargingPoints)
  const allEvents = useMobilityStore((s) => s.chargingRequestEvents)
  const request = useMobilityStore((s) => s.chargingRequests.find((item) => item.requestId === requestId))
  const cancelRequest = useMobilityStore((s) => s.cancelChargingRequest)

  if (!request || request.source !== 'STUDENT' || request.requesterId !== DEMO_STUDENT_ID) {
    return <Card><CardTitle title="Không tìm thấy yêu cầu sạc" subtitle={`Yêu cầu ${requestId} không tồn tại hoặc không thuộc tài khoản của bạn.`} />
      <Link to="/student/private-ev" className="text-sm font-semibold text-[#087f6a] hover:underline">Quay lại gửi yêu cầu sạc</Link></Card>
  }

  const events = allEvents.filter((event) => event.requestId === request.requestId)
  const view = describeRequest(request, events)
  const change = latestChange(events)
  const hubName = hubs.find((item) => item.hubId === request.hubId)?.name ?? request.hubId
  const myVehicles = privateEVs.filter((ev) => ev.ownerStudentId === DEMO_STUDENT_ID)
  const cancellable = CANCELLABLE_CHARGING_STATUSES.includes(request.status)
  const freePoints = (id: string) => chargingPoints.filter((point) => point.hubId === id && point.status === 'AVAILABLE').length
  const alternative = hubs.filter((item) => item.hubId !== request.hubId && freePoints(item.hubId) > 0)
    .sort((a, b) => freePoints(b.hubId) - freePoints(a.hubId))[0]
  const desiredWindow = request.desiredStart && request.desiredEnd
    ? `${formatTime(request.desiredStart)} – ${formatTime(request.desiredEnd)} · ${formatShortDate(request.desiredStart)}` : '—'

  const changeSchedule = () => {
    if (cancellable) cancelRequest(DEMO_STUDENT_ID, request.requestId)
    navigate(`/student/private-ev?evId=${request.vehicleId}&hubId=${request.hubId}`)
  }

  const banner = view.changed && change
    ? <Notice tone="warn" title={`Lịch sạc đã thay đổi lúc ${formatTime(change.at)}`}>
      {change.type === 'RESCHEDULED'
        ? `Cổng ${change.previousChargingPointId ?? '—'} không còn dành cho bạn. Yêu cầu ${request.requestId} đã quay lại trạng thái chờ xếp lịch, bạn không cần gửi lại.`
        : `Lịch của yêu cầu ${request.requestId} đã chuyển từ cổng ${change.previousChargingPointId ?? '—'} sang cổng ${request.chargingPointId ?? '—'}.`}
    </Notice>
    : request.status === 'SCHEDULED' ? <Notice tone="success" title="Đã có lịch sạc">Cổng {request.chargingPointId}{request.scheduledStart ? `, bắt đầu ${formatTime(request.scheduledStart)}` : ''}.</Notice>
      : request.status === 'EXPIRED' ? <Notice tone="danger" title="Yêu cầu đã hết hạn">Không xếp được cổng trong khung giờ {desiredWindow}.</Notice>
        : null

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow={`Xe cá nhân / Yêu cầu ${request.requestId}`} title={`Yêu cầu sạc ${request.requestId}`}
      subtitle={view.changed ? 'Lịch sạc của bạn vừa thay đổi. Yêu cầu đã quay lại hàng đợi để hệ thống xếp lại.' : view.description} />

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        {banner}
        <PrivateEvCard vehicles={myVehicles} selectedId={request.vehicleId} now={now} />

        <Card>
          <CardTitle title="Lịch sử yêu cầu" subtitle="Cập nhật từ hệ thống lập lịch" />
          <ol>
            {events.map((event) => {
              const item = describeEvent(event, request)
              return <li key={event.eventId} className="grid grid-cols-[64px_16px_1fr] gap-3 border-b border-[#e4ece9] py-3 last:border-0">
                <span className="text-sm text-[#5f716c]">{formatTime(event.at)}</span>
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotColor[item.tone]}`} />
                <div><p className={`text-sm font-semibold ${item.tone === 'danger' ? 'text-[#b42318]' : 'text-[#17332f]'}`}>{item.title}</p><p className="mt-0.5 text-sm text-[#5f716c]">{item.detail}</p></div>
              </li>
            })}
            <li className="grid grid-cols-[64px_16px_1fr] gap-3 py-3">
              <span className="text-sm text-[#5f716c]">Hiện tại</span>
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotColor[view.tagTone]}`} />
              <div><p className="text-sm font-semibold text-[#17332f]">{view.tag}</p><p className="mt-0.5 text-sm text-[#5f716c]">{request.chargingPointId ? `Cổng ${request.chargingPointId}${request.scheduledStart ? `, bắt đầu ${formatTime(request.scheduledStart)}` : ''}.` : 'Chưa có cổng và giờ.'}</p></div>
            </li>
          </ol>
        </Card>

        {(request.status === 'WAITING' || request.status === 'NEEDS_VERIFICATION') && <Notice tone="info" title={view.changed ? 'Nếu không xếp lại được' : 'Nếu không xếp được'}>
          Nếu đến {request.desiredEnd ? formatTime(request.desiredEnd) : 'hết khung giờ'} hệ thống vẫn chưa xếp được cổng trong khung giờ bạn chọn, yêu cầu chuyển sang Hết hạn. Bạn sẽ nhận thông báo kèm gợi ý Hub hoặc khung giờ khác.
        </Notice>}
      </div>

      <aside className="min-w-0 space-y-6">
        <HubChargingSnapshot hubId={request.hubId} now={now} />

        <Card tone={view.tone}>
          <CardTitle title={view.title} subtitle={change ? `Thông báo lúc ${formatTime(change.at)}` : `Gửi lúc ${formatTime(request.createdAt)}`} />
          <StatusTag tone={view.tagTone}>{view.tag}</StatusTag>
          <BigCode>{request.requestId}</BigCode>
          <DetailRow label="Xe / Hub" value={`${request.vehicleId} / ${hubName}`} />
          <DetailRow label="Khung giờ mong muốn" value={desiredWindow} />
          {view.changed && change && <DetailRow label="Lịch cũ (đã hủy)" strike
            value={`${change.previousChargingPointId ?? '—'}${change.previousScheduledStart ? ` · ${formatTime(change.previousScheduledStart)}` : ''}`} />}
          <DetailRow label={view.changed ? 'Cổng sạc mới' : 'Cổng sạc'} value={request.chargingPointId ?? 'Chưa được cấp'} />
          <DetailRow label={view.changed ? 'Giờ bắt đầu mới' : 'Giờ bắt đầu'} value={request.chargingPointId ? (request.scheduledStart ? formatTime(request.scheduledStart) : 'Chờ hệ thống báo giờ') : 'Chưa được cấp'} />
          <DetailRow label="Mức pin" value={`${request.battery}% · ${request.batteryVerified === false ? 'Chưa xác minh' : 'Đọc từ xe'}`} />
          <p className="mt-3 text-sm leading-6 text-[#17332f]">{view.description}</p>
          <div className="mt-4 space-y-3">
            {(cancellable || request.status === 'EXPIRED') && <Button variant="outline" onClick={changeSchedule}>{request.status === 'EXPIRED' ? 'Gửi yêu cầu mới' : 'Đổi khung giờ hoặc Hub'}</Button>}
            {cancellable && <Button variant="danger" onClick={() => cancelRequest(DEMO_STUDENT_ID, request.requestId)}>Hủy yêu cầu sạc</Button>}
          </div>
        </Card>

        <Card>
          <CardTitle title="Nếu yêu cầu không xếp được" />
          <p className="text-sm leading-6 text-[#5f716c]">Yêu cầu chuyển sang Hết hạn và bạn nhận gợi ý{alternative ? `: ${alternative.name} hiện có ${freePoints(alternative.hubId)} cổng trống, hoặc khung giờ khác tại ${hubName}` : ' Hub hoặc khung giờ khác'}. Với gợi ý, bạn gửi một yêu cầu mới.</p>
          {alternative && <Link to={`/student/private-ev?evId=${request.vehicleId}&hubId=${alternative.hubId}`} className="mt-3 inline-block text-sm font-semibold text-[#087f6a] hover:underline">Xem Hub thay thế →</Link>}
        </Card>
      </aside>
    </div>
  </div>
}
