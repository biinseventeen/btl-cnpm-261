// VJ-04 Nhận xe bằng QR (Figma Mobile_VJ04_1 113:11 and Mobile_VJ04_2 113:70, laid out for desktop)
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, CircleCheck, QrCode, ScanLine } from 'lucide-react'
import { useMobilityStore } from '../../../store/useMobilityStore'
import { Button, Card, DetailRow, Notice, PageHeader, SmallLabel, StatusTag, inputClass } from '../../../components/shared/ui'
import { formatTime, hubLabel } from '../../../lib/format'
import { vehicleTypeLabel } from '../../../lib/labels'
import { DEMO_STUDENT_ID } from '../../../lib/demoUser'
import { useNow } from '../../../lib/useNow'
import { pickUpErrorText } from '../journey'

export default function PickupPage() {
  const now = useNow()
  const navigate = useNavigate()
  const hubs = useMobilityStore((s) => s.hubs)
  const vehicles = useMobilityStore((s) => s.vehicles)
  const reservations = useMobilityStore((s) => s.vehicleReservations)
  const pickUp = useMobilityStore((s) => s.pickUpVehicle)
  const [scanned, setScanned] = useState('')
  const [error, setError] = useState<string>()
  const [doneId, setDoneId] = useState<string>()

  const mine = reservations.filter((item) => item.studentId === DEMO_STUDENT_ID)
  const reservation = doneId ? mine.find((item) => item.reservationId === doneId) : mine.filter((item) => item.status === 'RESERVED').at(-1)
  const vehicle = vehicles.find((item) => item.vehicleId === reservation?.vehicleId)
  const hub = hubs.find((item) => item.hubId === reservation?.hubId)

  if (!reservation || !vehicle) {
    return <div className="space-y-6">
      <PageHeader now={now} eyebrow="Hành trình của tôi / Nhận xe" title="Không có xe chờ nhận" subtitle="Bạn cần đặt trước một xe trước khi quét mã QR." />
      <Card><Link to="/student/trips" className="text-sm font-semibold text-[#087f6a] hover:underline">Mở hành trình của tôi</Link></Card>
    </div>
  }

  if (doneId && reservation.status === 'IN_USE') {
    return <div className="space-y-6">
      <PageHeader now={now} eyebrow="Hành trình của tôi / Nhận xe" title="Nhận xe thành công" subtitle="Mã QR khớp với đặt trước của bạn." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card tone="success" className="text-center">
          <CircleCheck size={56} className="mx-auto text-[#087f6a]" />
          <p className="mt-4 text-2xl font-semibold text-[#17332f]">Xe đã được xác thực</p>
          <p className="mt-2 text-sm text-[#5f716c]">Hệ thống ghi nhận thời điểm nhận xe lúc {formatTime(reservation.pickedUpAt)} và chuyển trạng thái sang Đang sử dụng.</p>
        </Card>
        <Card>
          <SmallLabel>Phương tiện</SmallLabel>
          <p className="mt-1 text-xl font-semibold text-[#17332f]">{vehicle.vehicleId} · {vehicleTypeLabel(vehicle)}</p>
          <div className="mt-2"><StatusTag tone="success">Đã bàn giao</StatusTag></div>
          <div className="mt-3">
            <DetailRow label="Hub nhận xe" value={hubLabel(hub)} />
            <DetailRow label="Pin hiện tại" value={`${vehicle.battery}%`} />
            <DetailRow label="Mã đặt trước" value={reservation.reservationId} />
          </div>
          <Button className="mt-4" onClick={() => navigate('/student/trips')}>Xem hành trình</Button>
        </Card>
      </div>
    </div>
  }

  const confirm = () => {
    const result = pickUp(DEMO_STUDENT_ID, reservation.reservationId, scanned)
    if (result.ok) { setDoneId(reservation.reservationId); setError(undefined) }
    else setError(result.reason === 'QR_MISMATCH'
      ? `Mã QR (${scanned.trim().toUpperCase()}) không khớp với xe bạn đã đặt (${vehicle.vehicleId}). Nếu xe khác mã, hãy báo Operator.`
      : pickUpErrorText[result.reason])
  }

  return <div className="space-y-6">
    <PageHeader now={now} eyebrow="Hành trình của tôi / Nhận xe" title="Quét mã QR trên xe" subtitle="Đưa mã QR trên thân xe vào vùng quét để xác thực đặt trước." />
    {error && <Notice tone="danger" title="Chưa nhận được xe">{error}{reservation.status === 'EXPIRED' && <> <Link to="/student/trips" className="font-semibold underline">Xem phiếu</Link></>}</Notice>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="rounded-2xl bg-[#1d3a35] p-6">
        <span className="inline-flex rounded-full bg-[#e6f4ef] px-3 py-1 text-xs font-semibold uppercase text-[#087f6a]">Camera sẵn sàng</span>
        <div className="mx-auto mt-5 grid max-w-sm place-items-center rounded-2xl bg-[#f4f7f6] p-8 text-center">
          <QrCode size={110} className="text-[#17332f]" />
          <p className="mt-3 text-xs font-semibold uppercase text-[#5f716c]">Mã QR minh họa</p>
        </div>
        <p className="mt-4 text-center text-sm font-semibold text-white">Căn mã QR vào chính giữa khung</p>
        <div className="mx-auto mt-5 max-w-sm space-y-3">
          <button type="button" onClick={() => { setScanned(vehicle.vehicleId); setError(undefined) }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"><ScanLine size={16} /> Quét mã trên xe {vehicle.vehicleId}</button>
          <label htmlFor="qr-code" className="block text-xs text-white/80">Hoặc nhập mã đọc được trên xe</label>
          <input id="qr-code" value={scanned} onChange={(event) => setScanned(event.target.value)} placeholder="Ví dụ SM-001" className={inputClass} />
        </div>
      </section>
      <aside className="min-w-0 space-y-6">
        <Card>
          <SmallLabel>Phương tiện đã đặt</SmallLabel>
          <div className="mt-1 flex items-center justify-between gap-3"><p className="text-2xl font-semibold text-[#17332f]">{vehicle.vehicleId}</p><StatusTag tone="success">Sẵn sàng</StatusTag></div>
          <div className="mt-3">
            <DetailRow label="Hub" value={hubLabel(hub)} />
            <DetailRow label="Phiếu" value={`${reservation.reservationId} · Giữ đến ${formatTime(reservation.expiresAt)}`} />
          </div>
        </Card>
        <div className="rounded-2xl bg-[#fff4df] p-5 text-[#946013]">
          <p className="text-sm font-semibold">Kiểm tra đúng mã xe</p>
          <p className="mt-1 text-sm leading-6">Chỉ xác nhận khi mã xe khớp với đặt trước của bạn. Nếu xe khác mã, hãy báo Operator.</p>
        </div>
        <Button icon={<Check size={16} />} disabled={!scanned.trim()} onClick={confirm}>Xác nhận nhận xe</Button>
        <Button variant="outline" onClick={() => navigate('/student/trips')}>Quay lại phiếu đặt xe</Button>
      </aside>
    </div>
  </div>
}
