interface StatCardProps { label: string; value: string | number; hint?: string }
export default function StatCard({ label, value, hint }: StatCardProps) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
  </section>
}