// Building blocks shared by every screen, colors taken from the Figma ui-mockup.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CircleAlert, CircleCheck, FlaskConical, Info } from 'lucide-react'
import { formatClock } from '../../lib/format'

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

export function PageHeader({ eyebrow, title, subtitle, now, clockSuffix }: { eyebrow: string; title: string; subtitle: ReactNode; now: number; clockSuffix?: string }) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#087f6a]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-[#17332f] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-[#5f716c]">{subtitle}</p>
    </div>
    <p className="text-xs tabular-nums text-[#5f716c]">{formatClock(now)}{clockSuffix && ` · ${clockSuffix}`}</p>
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


export type PillTone = Tone | 'blue' | 'purple'
const pillTone: Record<PillTone, string> = {
  success: 'bg-[#e6f4ef] text-[#087f6a]',
  warn: 'bg-[#fff4df] text-[#946013]',
  danger: 'bg-[#fde8e6] text-[#b42318]',
  info: 'bg-[#edf4fa] text-[#2b5f8e]',
  neutral: 'bg-[#eaf0ee] text-[#5f716c]',
  blue: 'bg-[#e8eefb] text-[#3456a8]',
  purple: 'bg-[#f1ecfb] text-[#6b47b8]',
}

// Rounded status chip used inside tables and lists (sentence case, unlike StatusTag)
export function Pill({ tone, children, className = '' }: { tone: PillTone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${pillTone[tone]} ${className}`}>{children}</span>
}

export function KpiCard({ label, value, hint, hintTone = 'success' }: { label: string; value: ReactNode; hint?: ReactNode; hintTone?: Tone }) {
  const hintColor: Record<Tone, string> = { success: 'text-[#087f6a]', warn: 'text-[#946013]', danger: 'text-[#b42318]', info: 'text-[#2b5f8e]', neutral: 'text-[#5f716c]' }
  return <section className="rounded-2xl border border-[#e4ece9] bg-white p-5">
    <p className="text-sm text-[#5f716c]">{label}</p>
    <p className="mt-2 text-3xl font-semibold tabular-nums text-[#17332f]">{value}</p>
    {hint && <p className={`mt-2 text-xs ${hintColor[hintTone]}`}>{hint}</p>}
  </section>
}

export function BarRow({ label, value, max, color }: { label: ReactNode; value: number; max: number; color: string }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return <div>
    <div className="flex items-center justify-between text-sm text-[#17332f]"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#eaf0ee]"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} /></div>
  </div>
}

// Controls that stand in for real IoT devices or other users during the demo
export function DemoPanel({ title = 'Bảng mô phỏng demo', children }: { title?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-dashed border-[#b9c9c4] bg-[#fbfcfc] p-4">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5f716c]"><FlaskConical size={14} /> {title}</p>
    <div className="mt-3 flex flex-wrap gap-2">{children}</div>
  </section>
}

export function DemoButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="rounded-lg border border-[#d7e2de] bg-white px-3 py-2 text-xs font-semibold text-[#17332f] hover:bg-[#f4f7f6] disabled:cursor-not-allowed disabled:opacity-40">{children}</button>
}

export function Checkbox({ checked, onChange, label, hint, id }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; hint?: ReactNode; id: string }) {
  return <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#087f6a]" />
    <span><span className="block text-sm font-medium text-[#17332f]">{label}</span>{hint && <span className="mt-1 block text-xs text-[#5f716c]">{hint}</span>}</span>
  </label>
}

export function SmallLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-[#5f716c]">{children}</p>
}

export const tableHeadClass = 'bg-[#f4f7f6] text-left text-xs font-semibold uppercase text-[#5f716c]'
