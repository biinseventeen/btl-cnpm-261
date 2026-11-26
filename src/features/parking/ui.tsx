// Building blocks for the Parking & Private EV screens, colors taken from the Figma ui-mockup.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowRight, CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ParkingReservationStatus } from '../../types'
import { formatClock, formatTime } from './format'

export type Tone = 'success' | 'warn' | 'danger' | 'info' | 'neutral'

const cardTone: Record<Tone | 'default', string> = {
  default: 'border-[#e4ece9] bg-white',
  success: 'border-[#cfe6de] bg-[#e6f4ef]',
  warn: 'border-[#f0dcb4] bg-[#fffaf0]',
  danger: 'border-[#f3c5c0] bg-[#fff7f6]',
  info: 'border-[#d5e4f1] bg-[#edf4fa]',
  neutral: 'border-[#e4ece9] bg-[#f4f7f6]',
}

const tagTone: Record<Tone, string> = {
  success: 'text-[#087f6a]',
  warn: 'bg-[#fff4df] text-[#946013]',
  danger: 'bg-[#fde8e6] text-[#b42318]',
  info: 'bg-[#edf4fa] text-[#2b5f8e]',
  neutral: 'bg-[#eaf0ee] text-[#5f716c]',
}

const noticeTone: Record<Tone, { box: string; title: string; body: string; Icon: typeof Info }> = {
  success: { box: 'bg-[#e6f4ef]', title: 'text-[#087f6a]', body: 'text-[#087f6a]', Icon: CircleCheck },
  warn: { box: 'bg-[#fff4df]', title: 'text-[#946013]', body: 'text-[#946013]', Icon: Info },
  danger: { box: 'bg-[#fde8e6]', title: 'text-[#b42318]', body: 'text-[#b42318]', Icon: CircleAlert },
  info: { box: 'bg-[#edf4fa]', title: 'text-[#2b5f8e]', body: 'text-[#2b5f8e]', Icon: Info },
  neutral: { box: 'bg-[#f4f7f6]', title: 'text-[#17332f]', body: 'text-[#5f716c]', Icon: Info },
}

export function PageHeader({ eyebrow, title, subtitle, now }: { eyebrow: string; title: string; subtitle: ReactNode; now: number }) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#087f6a]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#17332f] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-[#5f716c]">{subtitle}</p>
    </div>
    <p className="text-xs tabular-nums text-[#5f716c]">{formatClock(now)}</p>
  </header>
}

export function Card({ tone = 'default', className = '', children }: { tone?: Tone | 'default'; className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border p-5 sm:p-6 ${cardTone[tone]} ${className}`}>{children}</section>
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div><h3 className="text-lg font-semibold text-[#17332f]">{title}</h3>{subtitle && <p className="mt-1 text-sm text-[#5f716c]">{subtitle}</p>}</div>
    {action}
  </div>
}

export function DetailRow({ label, value, strike = false, valueClassName = '' }: { label: string; value: ReactNode; strike?: boolean; valueClassName?: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#e4ece9] py-3 text-sm last:border-0">
    <span className="text-[#5f716c]">{label}</span>
    <span className={`text-right font-semibold text-[#17332f] ${strike ? 'text-[#8a9a96] line-through' : ''} ${valueClassName}`}>{value}</span>
  </div>
}

export function StatusTag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${tagTone[tone]}`}>{children}</span>
}

export function BigCode({ children }: { children: ReactNode }) {
  return <p className="mt-4 mb-2 break-all text-2xl font-semibold text-[#17332f]">{children}</p>
}

type ButtonVariant = 'primary' | 'outline' | 'danger'
const buttonVariant: Record<ButtonVariant, string> = {
  primary: 'bg-[#087f6a] text-white hover:bg-[#066b59] disabled:bg-[#9cc8bd]',
  outline: 'border border-[#d7e2de] bg-white text-[#17332f] hover:bg-[#f4f7f6] disabled:text-[#8a9a96]',
  danger: 'border border-[#f0b8b1] bg-white text-[#b42318] hover:bg-[#fff7f6] disabled:text-[#e3a49c]',
}

export function Button({ variant = 'primary', icon, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) {
  return <button type="button" {...props}
    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${buttonVariant[variant]} ${className}`}>
    {icon}{children}
  </button>
}

export function Notice({ tone, title, children }: { tone: Tone; title: ReactNode; children?: ReactNode }) {
  const { box, title: titleColor, body, Icon } = noticeTone[tone]
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-xl p-4 ${box}`}>
    <Icon size={18} className={`mt-0.5 shrink-0 ${titleColor}`} />
    <div className="min-w-0"><p className={`text-sm font-semibold ${titleColor}`}>{title}</p>{children && <div className={`mt-1 text-sm leading-6 ${body}`}>{children}</div>}</div>
  </div>
}

export const inputClass = 'w-full rounded-lg border border-[#d7e2de] bg-white px-3 py-2.5 text-sm text-[#17332f] outline-none focus:border-[#087f6a] focus:ring-2 focus:ring-[#087f6a]/20 disabled:bg-[#f4f7f6]'

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div><label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-[#17332f]">{label}</label>{children}</div>
}

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
