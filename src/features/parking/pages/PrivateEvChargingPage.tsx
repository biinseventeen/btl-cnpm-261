// PK-02 (Figma 146:185): send a private EV charging request. Submitting only queues the request;
// the scheduler (Kiệt) decides the charging point and time.
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PlugZap } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { ACTIVE_CHARGING_STATUSES, CANCELLABLE_CHARGING_STATUSES, isTelemetryFresh } from '../../../store/parkingSlice'
import HubChargingSnapshot from '../components/HubChargingSnapshot'
import PrivateEvCard from '../components/PrivateEvCard'
import { describeRequest } from '../chargingStatus'
import { DEMO_STUDENT_ID } from '../constants'
import { chargingErrorMessage, combineDateTime, formatShortDate, formatTime, hubLabel, roundUpMinutes, toDateInput, toTimeInput } from '../format'
import { useNow } from '../useNow'
import { BigCode, Button, Card, CardTitle, DetailRow, Field, inputClass, Notice, PageHeader, StatusTag } from '../ui'

const MINUTE = 60 * 1000
const DURATIONS = [30, 60, 90, 120, 180]

export default function PrivateEvChargingPage() {
  const now = useNow()
  const [searchParams] = useSearchParams()
  const hubs = useMobilityStore((s) => s.hubs)
  const privateEVs = useMobilityStore((s) => s.privateEVs)
  const requests = useMobilityStore((s) => s.chargingRequests)
  const events = useMobilityStore((s) => s.chargingRequestEvents)
  const chargingPoints = useMobilityStore((s) => s.chargingPoints)
  const submitRequest = useMobilityStore((s) => s.submitPrivateEvChargingRequest)
  const cancelRequest = useMobilityStore((s) => s.cancelChargingRequest)

  const myVehicles = useMemo(() => privateEVs.filter((ev) => ev.ownerStudentId === DEMO_STUDENT_ID), [privateEVs])
  const [evId, setEvId] = useState(() => {
    const requested = searchParams.get('evId')
    return myVehicles.some((ev) => ev.evId === requested) ? requested! : myVehicles[0]?.evId ?? ''
  })
  const [hubId, setHubId] = useState(() => {
    const requested = searchParams.get('hubId')
    return hubs.some((hub) => hub.hubId === requested) ? requested! : hubs[0]?.hubId ?? ''
  })
  const [date, setDate] = useState(() => toDateInput(roundUpMinutes(Date.now() + 30 * MINUTE, 5)))
  const [time, setTime] = useState(() => toTimeInput(roundUpMinutes(Date.now() + 30 * MINUTE, 5)))
  const [duration, setDuration] = useState(60)
  const [battery, setBattery] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [nextUse, setNextUse] = useState('')
  const [error, setError] = useState<string>()

  const vehicle = myVehicles.find((ev) => ev.evId === evId)
  const hub = hubs.find((item) => item.hubId === hubId)
  const fresh = !!vehicle && vehicle.battery !== undefined && isTelemetryFresh(vehicle.lastTelemetryAt, now)
  const desiredStart = combineDateTime(date, time)
  const desiredEnd = desiredStart ? new Date(new Date(desiredStart).getTime() + duration * MINUTE).toISOString() : ''
  const vehicleRequests = requests.filter((request) => request.source === 'STUDENT' && request.vehicleId === evId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = vehicleRequests[0]
  const active = vehicleRequests.find((request) => ACTIVE_CHARGING_STATUSES.includes(request.status))
  const freePoints = (id: string) => chargingPoints.filter((point) => point.hubId === id && point.status === 'AVAILABLE').length
  const alternative = hubs.filter((item) => item.hubId !== hubId && freePoints(item.hubId) > 0)
    .sort((a, b) => freePoints(b.hubId) - freePoints(a.hubId))[0]

  const submit = () => {
    const result = submitRequest({
      studentId: DEMO_STUDENT_ID, evId, hubId, desiredStart, desiredEnd,
      nextUseAt: nextUse ? new Date(nextUse).toISOString() : undefined,
      manualBattery: fresh || battery.trim() === '' ? undefined : Number(battery),
      manualBatteryConfirmed: confirmed,
    })
    if (result.ok) {
      setError(undefined)
      setBattery('')
      setConfirmed(false)
    } else {
      setError(chargingErrorMessage[result.reason])
    }
  }

  const currentView = current ? describeRequest(current, events.filter((event) => event.requestId === current.requestId)) : undefined

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Xe cá nhân / Yêu cầu sạc" title="Gửi yêu cầu sạc"
      subtitle="Bạn gửi nhu cầu sạc. Hệ thống lập lịch quyết định cổng và giờ sạc, rồi báo lại cho bạn." />

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <PrivateEvCard vehicles={myVehicles} selectedId={evId} now={now} onSelect={(id) => { setEvId(id); setError(undefined) }} />

        <Card>
          <CardTitle title="Yêu cầu sạc" subtitle="Khung giờ mong muốn · chưa phải đặt cổng sạc" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hub sạc" htmlFor="ev-hub">
              <select id="ev-hub" className={inputClass} value={hubId} onChange={(event) => setHubId(event.target.value)}>
                {hubs.map((item) => <option key={item.hubId} value={item.hubId}>{hubLabel(item)}</option>)}
              </select>
            </Field>
            <Field label="Ngày mong muốn" htmlFor="ev-date">
              <input id="ev-date" type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Có mặt từ" htmlFor="ev-time">
              <input id="ev-time" type="time" className={inputClass} value={time} onChange={(event) => setTime(event.target.value)} />
            </Field>
            <Field label="Thời lượng mong muốn" htmlFor="ev-duration">
              <select id="ev-duration" className={inputClass} value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} phút</option>)}
              </select>
            </Field>
            <Field label="Pin hiện tại" htmlFor="ev-battery">
              {fresh
                ? <input id="ev-battery" className={inputClass} value={`${vehicle!.battery}% · Đọc từ xe lúc ${formatTime(vehicle!.lastTelemetryAt)}`} disabled />
                : <input id="ev-battery" type="number" min={0} max={100} step={1} inputMode="numeric" placeholder="Nhập mức pin, ví dụ 18"
                  className={inputClass} value={battery} onChange={(event) => setBattery(event.target.value)} />}
            </Field>
            <Field label="Lần sử dụng tiếp theo (tùy chọn)" htmlFor="ev-next">
              <input id="ev-next" type="datetime-local" className={inputClass} value={nextUse} onChange={(event) => setNextUse(event.target.value)} />
            </Field>
          </div>

          <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${fresh ? 'bg-[#e6f4ef] text-[#087f6a]' : 'bg-[#eaf0ee] text-[#5f716c]'}`}>{fresh ? 'Đã xác minh từ xe' : 'Cần xác minh'}</span>

          {!fresh && <div className="mt-4 space-y-4">
            <Notice tone="warn" title="Chưa nhận được dữ liệu pin từ xe">
              Mức pin bạn nhập tay được đánh dấu chưa xác minh. Yêu cầu vẫn được gửi, hệ thống lập lịch sẽ dùng mức pin này khi tính ưu tiên.
            </Notice>
            <label className="flex items-start gap-3 text-sm text-[#17332f]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#087f6a]" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              Tôi xác nhận mức pin nhập đúng theo hiển thị trên xe.
            </label>
          </div>}

          <div className="mt-5 space-y-3">
            {active && <Notice tone="warn" title="Xe đang có yêu cầu chưa kết thúc">
              Yêu cầu <Link to={`/student/private-ev/${active.requestId}`} className="font-semibold underline">{active.requestId}</Link> của {evId} vẫn đang xử lý. Hủy yêu cầu đó trước nếu muốn gửi lại.
            </Notice>}
            {error && <Notice tone="danger" title="Chưa gửi được yêu cầu">{error}</Notice>}
            <Button onClick={submit} disabled={!vehicle || !hub || !!active} icon={<PlugZap size={18} />} className="sm:w-auto">Gửi yêu cầu sạc</Button>
          </div>
        </Card>

        <Notice tone="info" title="Gửi yêu cầu chưa phải là có cổng sạc">
          Cổng và giờ sạc do hệ thống lập lịch quyết định, dựa trên thời điểm bạn có mặt, công suất của Hub và các yêu cầu khác. Bạn nhận thông báo khi có lịch hoặc khi yêu cầu không xếp được.
        </Notice>
      </div>

      <aside className="min-w-0 space-y-6">
        <HubChargingSnapshot hubId={hubId} now={now} />

        {current && currentView && <Card tone={currentView.tone}>
          <CardTitle title={currentView.title} subtitle={`Gửi lúc ${formatTime(current.createdAt)}`} />
          <StatusTag tone={currentView.tagTone}>{currentView.tag}</StatusTag>
          <BigCode>{current.requestId}</BigCode>
          <DetailRow label="Xe / Hub" value={`${current.vehicleId} / ${hubs.find((item) => item.hubId === current.hubId)?.name ?? current.hubId}`} />
          <DetailRow label="Khung giờ mong muốn" value={current.desiredStart && current.desiredEnd ? `${formatTime(current.desiredStart)} – ${formatTime(current.desiredEnd)} · ${formatShortDate(current.desiredStart)}` : '—'} />
          <DetailRow label="Cổng sạc" value={current.chargingPointId ?? 'Chưa được cấp'} />
          <DetailRow label="Giờ bắt đầu" value={current.chargingPointId ? (current.scheduledStart ? formatTime(current.scheduledStart) : 'Chờ hệ thống báo giờ') : 'Chưa được cấp'} />
          <DetailRow label="Mức pin" value={`${current.battery}% · ${current.batteryVerified === false ? 'Chưa xác minh' : 'Đọc từ xe'}`} />
          <p className="mt-3 text-sm leading-6 text-[#17332f]">{currentView.description}</p>
          <div className="mt-4 space-y-3">
            <Link to={`/student/private-ev/${current.requestId}`} className="block rounded-lg border border-[#d7e2de] bg-white px-4 py-3 text-center text-sm font-semibold text-[#17332f] hover:bg-[#f4f7f6]">Xem yêu cầu sạc</Link>
            {CANCELLABLE_CHARGING_STATUSES.includes(current.status) && <Button variant="danger" onClick={() => cancelRequest(DEMO_STUDENT_ID, current.requestId)}>Hủy yêu cầu sạc</Button>}
          </div>
        </Card>}

        <Card>
          <CardTitle title="Nếu yêu cầu không xếp được" />
          <p className="text-sm leading-6 text-[#5f716c]">Yêu cầu chuyển sang Hết hạn và bạn nhận gợi ý{alternative ? `: ${alternative.name} hiện có ${freePoints(alternative.hubId)} cổng trống, hoặc một khung giờ khác tại ${hub?.name ?? 'Hub này'}` : ' Hub hoặc khung giờ khác'}. Với gợi ý, bạn gửi một yêu cầu mới.</p>
          {alternative && <button type="button" onClick={() => setHubId(alternative.hubId)} className="mt-3 text-sm font-semibold text-[#087f6a] hover:underline">Xem Hub thay thế →</button>}
        </Card>
      </aside>
    </div>
  </div>
}

