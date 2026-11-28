export default function StatusPill({ status }: { status: string }) {
  const positive = ['AVAILABLE', 'RESOLVED', 'FULFILLED', 'COMPLETED', 'APPLIED'].includes(status)
  const warning = ['WAITING', 'PENDING_CHARGING', 'ASSIGNED', 'IN_PROGRESS', 'STALE'].includes(status)
  const theme = positive ? 'bg-emerald-50 text-emerald-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${theme}`}>{status.replaceAll('_', ' ')}</span>
}