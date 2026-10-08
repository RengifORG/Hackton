import type { ReactNode } from 'react'

export type BadgeVariant = 'warning' | 'success' | 'neutral'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  warning: 'bg-amber-100 text-amber-900 ring-amber-300',
  success: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  neutral: 'bg-slate-100 text-slate-800 ring-slate-300',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  )
}
