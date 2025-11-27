'use client'

import { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: string | ReactNode
  subtitle?: string
  accent?: 'orange' | 'blue' | 'green' | 'purple'
  children?: ReactNode
}

const accentStyles: Record<string, string> = {
  orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/30',
  blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/30',
  green: 'from-green-500/10 to-green-500/5 border-green-500/30',
  purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/30'
}

export function KpiCard({ title, value, subtitle, accent = 'orange', children }: KpiCardProps) {
  return (
    <div
      className={`rounded-3xl border bg-gradient-to-br p-6 shadow-lg shadow-black/5 ${accentStyles[accent]}`}
    >
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <div className="mt-3 text-4xl font-extrabold text-gray-900">{value}</div>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}




