'use client'

import type { DashboardCard } from '../types/home.types'
import { AppDashboardCard } from '@/features/common/components/AppDashboardCard'

interface DashboardCardProps {
  card: DashboardCard
  darkMode: boolean
  isGlobalLoading?: boolean
  isThisCardLoading?: boolean
  onNavigateStart?: (href: string) => void
}

const CARD_LABELS: Record<DashboardCard['icon'], string> = {
  pos: 'Ingresar al POS',
  admin: 'Ver panel admin',
  pedidos: 'Ver historial',
  clientes: 'Ver clientes',
  cocina: 'Abrir cocina 3D',
  mesas: 'Abrir panel mesas',
}

export function DashboardCardComponent({
  card,
  darkMode,
  isGlobalLoading = false,
  isThisCardLoading = false,
  onNavigateStart,
}: DashboardCardProps) {
  const label = CARD_LABELS[card.icon]

  return (
    <AppDashboardCard
      title={card.title}
      description={card.description}
      href={card.href}
      icon={card.icon}
      color={card.color}
      label={label}
      darkMode={darkMode}
      isGlobalLoading={isGlobalLoading}
      isThisCardLoading={isThisCardLoading}
      onNavigateStart={onNavigateStart}
    />
  )
}

