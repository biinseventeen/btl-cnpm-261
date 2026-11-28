// VJ-03 Xác nhận giữ xe (Figma 67:2) and VJ-03e Không giữ được xe (Figma 161:3)
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, CircleAlert, Info, QrCode } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { nextCode } from '../../../store/storeUtils'
import { estimatedRangeKm, isReservable, JOURNEY_RULES, type ReserveVehicleResult } from '../../../store/vehicleJourneySlice'
import { Button, Card, CardTitle, DemoButton, DemoPanel, DetailRow, Notice, PageHeader, StatusTag } from '../../../components/shared/ui'
import { formatShortDate, formatTime } from '../../../lib/format'
import { vehicleTypeLabel } from '../../../lib/labels'
import { DEMO_STUDENT_ID } from '../../../lib/demoUser'
import { useNow } from '../../../lib/useNow'
import { HoldTimeCard, SelectedVehicleCard, TicketCode } from '../components/JourneyCards'
import { reserveErrorText } from '../journey'

type Failure = Exclude<ReserveVehicleResult, { ok: true }>['reason']

export default function ReserveVehiclePage() {
  const { vehicleId = '' } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const reservations = useMobilityStore((s) => s.vehicleReservations)
  const reserve = useMobilityStore((s) => s.reserveSharedVehicle)
  const [failure, setFailure] = useState<{ reason: Failure; at: number }>()

  const vehicle = vehicles.find((item) => item.vehicleId === vehicleId)
  if (!vehicle) {
    return <Card><CardTitle title="Không tìm thấy xe" subtitle={`Xe ${vehicleId} không tồn tại.`} />
      <Link to="/student/vehicles" className="text-sm font-semibold text-[#087f6a] hover:underline">Quay lại chọn xe</Link></Card>
  }
  const hub = hubs.find((item) => item.hubId === vehicle.hubId)
  const holdEnd = now + JOURNEY_RULES.holdMinutes * 60 * 1000
  const previewCode = nextCode('VJ', reservations.map((item) => item.reservationId), now)
  const alternatives = vehicles.filter((item) => item.hubId === vehicle.hubId && item.vehicleId !== vehicle.vehicleId && isReservable(item) && !item.faultCode)
    .sort((a, b) => b.battery - a.battery).slice(0, 3)

  const confirm = (id: string) => {
    const result = reserve(DEMO_STUDENT_ID, id)
    if (result.ok) navigate('/student/trips')
    else setFailure({ reason: result.reason, at: Date.now() })
  }

  // VJ-03e: the request lost the race (or the vehicle stopped qualifying) and no ticket was created
  if (failure && failure.reason !== 'ACTIVE_RESERVATION_EXISTS') {
    const taken = failure.reason === 'ALREADY_RESERVED'
    const best = alternatives[0]
    return <div className="space-y-6">
      <PageHeader now={now} eyebrow="Hành trình của tôi / Đặt trước xe" title={`Không giữ được xe ${vehicle.vehicleId}`}
        subtitle={`${reserveErrorText[failure.reason]} Hệ thống không tạo phiếu và gợi ý xe tương đương tại cùng Hub.`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <SelectedVehicleCard title="Thông tin xe đã chọn" subtitle="Xe bạn vừa chọn từ danh sách Hub" vehicle={vehicle} hub={hub}
            tag={{ tone: 'danger', label: taken ? 'Đã được giữ' : 'Không đủ điều kiện' }} />
          <HoldTimeCard subtitle="Chưa áp dụng vì yêu cầu của bạn không giữ được xe" tone="none" caption="không có phiếu"
            message="Không có phiếu đặt xe nào được tạo và bạn không bị tính phí. Bạn có thể chọn ngay một xe tương đương ở cột bên phải." />
          <div className="flex gap-3 rounded-2xl bg-[#fff4df] p-5 text-[#946013]">
            <Info size={18} className="mt-0.5 shrink-0" />
            <div><p className="text-sm font-semibold">{taken ? 'Vì sao không giữ được xe?' : 'Vì sao xe không đủ điều kiện?'}</p>
              <p className="mt-1 text-sm leading-6">{taken
                ? 'Hai sinh viên bấm đặt cùng một xe gần như cùng lúc. Hệ thống chỉ giữ xe cho yêu cầu được xử lý trước, yêu cầu còn lại nhận thông báo này.'
                : `Xe chỉ được đặt khi đang Sẵn sàng, còn kết nối và pin trên ${JOURNEY_RULES.minBattery}%. Trạng thái xe vừa thay đổi trước khi bạn xác nhận.`}</p></div>
          </div>
        </div>
        <aside className="min-w-0 space-y-6">
          <Card tone="danger">
            <CardTitle title={taken ? 'Xe đã được người khác giữ' : 'Xe không còn khả dụng'} subtitle={`Cập nhật lúc ${formatTime(new Date(failure.at).toISOString())}`} />
            <StatusTag tone="danger">Không giữ được xe</StatusTag>
            <div className="mt-3">
              <DetailRow label="Xe bạn chọn" value={`${vehicle.vehicleId} · ${taken ? 'Đã được giữ' : 'Không đủ điều kiện'}`} />
              <DetailRow label="Phiếu đặt xe" value="Không được tạo" />
              <DetailRow label="Xe tương đương" value={`${alternatives.length} xe tại ${hub?.name ?? '—'}`} />
              <DetailRow label="Gợi ý gần nhất" value={best ? `${best.vehicleId} · ${best.battery}% · ~${estimatedRangeKm(best)} km` : 'Không có'} />
            </div>
            <div className="mt-4 space-y-3">
              {best && <Button icon={<Check size={16} />} onClick={() => confirm(best.vehicleId)}>Giữ xe thay thế {best.vehicleId}</Button>}
              <Button variant="outline" onClick={() => navigate(`/student/vehicles?hubId=${vehicle.hubId}`)}>Quay lại chọn xe</Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#5f716c]">Xe thay thế cũng được giữ theo cùng cơ chế. Nếu xe đó vừa bị người khác giữ, hệ thống sẽ báo lại và gợi ý xe tiếp theo.</p>
          </Card>
          <Card>
            <CardTitle title={`Xe tương đương tại Hub ${vehicle.hubId}`} />
            {alternatives.length === 0 ? <p className="text-sm text-[#5f716c]">Hub này đã hết xe sẵn sàng.</p> :
              <ul className="space-y-1 text-sm text-[#5f716c]">{alternatives.map((item) =>
                <li key={item.vehicleId}>{item.vehicleId} · {vehicleTypeLabel(item)} · {item.battery}% · ~{estimatedRangeKm(item)} km</li>)}</ul>}
            <Link to={`/student/vehicles?hubId=${vehicle.hubId}`} className="mt-3 inline-block text-sm font-semibold text-[#087f6a] hover:underline">Xem tất cả xe tại Hub</Link>
          </Card>
        </aside>
      </div>
    </div>
  }

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Hành trình của tôi / Đặt trước xe" title="Xác nhận giữ xe"
      subtitle="Kiểm tra thông tin xe và thời gian giữ chỗ trước khi xác nhận đặt trước." />
    {failure?.reason === 'ACTIVE_RESERVATION_EXISTS' && <Notice tone="danger" title="Không thể đặt thêm xe">
      {reserveErrorText.ACTIVE_RESERVATION_EXISTS} <Link to="/student/trips" className="font-semibold underline">Mở hành trình của tôi</Link>
    </Notice>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <SelectedVehicleCard title="Thông tin xe đã chọn" subtitle="Xe bạn vừa chọn từ danh sách Hub" vehicle={vehicle} hub={hub}
          tag={isReservable(vehicle) ? { tone: 'success', label: 'Sẵn sàng' } : { tone: 'warn', label: 'Chưa sẵn sàng' }} />
        <HoldTimeCard subtitle="Chính sách giữ xe áp dụng cho đơn đặt trước này" tone="active" caption="phút giữ xe tối đa"
          remainingMs={JOURNEY_RULES.holdMinutes * 60 * 1000} startedAt={new Date(now).toISOString()} expiresAt={new Date(holdEnd).toISOString()} hub={hub}
          message={`Xe sẽ được giữ cho bạn trong vòng ${JOURNEY_RULES.holdMinutes} phút. Vui lòng đến Hub ${hub?.name ?? ''} trước ${formatTime(new Date(holdEnd).toISOString())} để nhận xe.`} />
        <div className="flex gap-3 rounded-2xl bg-[#fff4df] p-5 text-[#946013]">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <div><p className="text-sm font-semibold">Lưu ý khi đặt trước</p><p className="mt-1 text-sm leading-6">Mỗi sinh viên chỉ giữ 1 xe tại một thời điểm. Bạn cần hoàn thành hoặc hủy đơn hiện tại trước khi đặt xe khác.</p></div>
        </div>
        <DemoPanel>
          <DemoButton disabled={vehicle.status !== 'AVAILABLE'} onClick={() => reserve('S-07', vehicle.vehicleId)}>Sinh viên khác vừa giữ xe {vehicle.vehicleId}</DemoButton>
        </DemoPanel>
      </div>

      <aside className="min-w-0 space-y-6">
        <Card tone="success">
          <CardTitle title="Xác nhận đặt xe" subtitle="Kiểm tra lần cuối trước khi giữ xe" />
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold uppercase text-[#087f6a]">Chờ xác nhận</span>
          <div className="mt-3">
            <DetailRow label="Xe" value={`${vehicle.vehicleId} · ${vehicleTypeLabel(vehicle)}`} />
            <DetailRow label="Hub nhận xe" value={hub?.name ?? '—'} />
            <DetailRow label="Giữ xe đến" value={`${formatTime(new Date(holdEnd).toISOString())} · ${formatShortDate(new Date(holdEnd).toISOString())}`} />
            <DetailRow label="Pin hiện tại" value={`${vehicle.battery}% · ~${estimatedRangeKm(vehicle)} km`} />
          </div>
          <div className="mt-4 space-y-3">
            <Button icon={<Check size={16} />} onClick={() => confirm(vehicle.vehicleId)}>Xác nhận đặt xe</Button>
            <Button variant="outline" onClick={() => navigate(`/student/vehicles?hubId=${vehicle.hubId}`)}>Quay lại chọn xe</Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5f716c]">Nếu quá {JOURNEY_RULES.holdMinutes} phút không nhận xe, hệ thống sẽ tự động hủy đơn đặt.</p>
        </Card>
        <Card>
          <CardTitle title="Sau khi đặt thành công" subtitle="Xem trước phiếu đặt xe" />
          <StatusTag tone="success">Đặt xe thành công · xem trước</StatusTag>
          <TicketCode code={previewCode} caption="Mã đặt xe / mã QR nhận xe" />
          <div className="mt-4">
            <DetailRow label="Đồng hồ đếm ngược" value="14:59" />
            <DetailRow label="Trạng thái xe" value="Reserved" />
          </div>
          <Button variant="outline" className="mt-4" icon={<QrCode size={16} />} disabled>Quét mã QR để nhận xe</Button>
        </Card>
        <Card>
          <CardTitle title="Nếu không đặt được" />
          <p className="text-sm leading-6 text-[#5f716c]">Nếu xe vừa bị người khác đặt hoặc pin chỉ còn từ {JOURNEY_RULES.minBattery}% trở xuống, hệ thống báo "Xe đã bị đặt hoặc không đủ pin" và gợi ý xe khác tại Hub.</p>
          <Link to={`/student/vehicles?hubId=${vehicle.hubId}`} className="mt-3 inline-block text-sm font-semibold text-[#087f6a] hover:underline">Xem xe thay thế →</Link>
        </Card>
      </aside>
    </div>
  </div>
}
