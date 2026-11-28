// Parking-specific blocks; the generic ones come from the shared UI kit.
import { ArrowRight, Info } from 'lucide-react'
import type { ParkingReservationStatus } from '../../types'
import { Card, CardTitle } from '../../components/shared/ui'
import { formatTime } from './format'

export * from '../../components/shared/ui'

const mainFlow: { status: ParkingReservationStatus; label: string }[] = [
  { status: 'HELD', label: 'Đã giữ chỗ' },
  { status: 'SLOT_ASSIGNED', label: 'Đã cấp ô (check-in)' },
  { status: 'ARRIVED', label: 'Đã đến (cảm biến xác nhận)' },
  { status: 'COMPLETED', label: 'Hoàn tất' },
]
const earlyEnds: { status: ParkingReservationStatus; label: string; idle: string; active: string }[] = [
  { status: 'CANCELLED', label: 'Đã hủy', idle: 'bg-[#fde8e6] text-[#b42318]', active: 'bg-[#b42318] text-white' },
  { status: 'EXPIRED', label: 'Hết hạn', idle: 'bg-[#fff4df] text-[#946013]', active: 'bg-[#946013] text-white' },
  { status: 'CHECK_IN_FAILED', label: 'Check-in thất bại', idle: 'bg-[#fde8e6] text-[#b42318]', active: 'bg-[#b42318] text-white' },
]

export function LifecycleCard({ status }: { status?: ParkingReservationStatus }) {
  return <Card>
    <CardTitle title="Vòng đời đặt chỗ" subtitle="Lúc đặt, hệ thống giữ 1 chỗ trong sức chứa của Hub. Ô cụ thể chỉ được cấp khi bạn check-in." />
    <div className="rounded-xl bg-[#e6f4ef] p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase text-[#5f716c]">Luồng chính</p>
      <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
        {mainFlow.map((step, index) => <li key={step.status} className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 ${status === step.status ? 'bg-[#087f6a] text-white' : 'bg-white text-[#087f6a]'}`}>{step.label}</span>
          {index < mainFlow.length - 1 && <ArrowRight size={14} className="text-[#5f716c]" />}
        </li>)}
      </ol>
      <p className="mt-3 text-sm leading-6 text-[#17332f]">Đặt chỗ chỉ giữ sức chứa của Hub. Khi check-in, hệ thống kiểm tra lại cảm biến và cấp 1 ô trống, giữ trong 10 phút. Cảm biến thấy xe vào đúng ô thì check-in hoàn tất. Rời bãi thì ô được trả lại.</p>
      <p className="mt-4 text-xs font-semibold uppercase text-[#5f716c]">Kết thúc sớm</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        {earlyEnds.map((end) => <span key={end.status} className={`rounded-full px-2.5 py-1 ${status === end.status ? end.active : end.idle}`}>{end.label}</span>)}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#17332f]">Đã hủy: bạn chủ động hủy trước hạn. Hết hạn: quá 15 phút chưa check-in, hệ thống tự hủy. Check-in thất bại: không còn ô trống có cảm biến hoạt động. Cả ba trường hợp đều trả chỗ giữ về Hub.</p>
    </div>
  </Card>
}

export function PolicyNote({ arrivalTime, expiresAt }: { arrivalTime?: string; expiresAt?: string }) {
  const window = arrivalTime && expiresAt ? `từ ${formatTime(arrivalTime)} đến ${formatTime(expiresAt)}` : 'từ giờ đến dự kiến tới 15 phút sau'
  return <div className="rounded-2xl bg-[#fff4df] p-5">
    <div className="flex gap-3">
      <Info size={18} className="mt-0.5 shrink-0 text-[#946013]" />
      <div><p className="text-sm font-semibold text-[#946013]">Chính sách giữ chỗ</p>
        <p className="mt-1 text-sm leading-6 text-[#946013]">Giữ 1 chỗ {window}. Check-in trong khoảng này để được cấp ô; ô được giữ thêm 10 phút để bạn đỗ xe vào. Nếu lúc check-in Hub hết ô, chỗ giữ được trả lại và hệ thống gợi ý Hub khác.</p></div>
    </div>
  </div>
}
