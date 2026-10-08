import { useId } from 'react'

interface KpiCardProps {
  label: string
  value: number
}

export function KpiCard({ label, value }: KpiCardProps) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <p id={labelId} className="text-sm text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
