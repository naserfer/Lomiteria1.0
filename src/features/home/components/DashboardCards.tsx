'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { DASHBOARD_CARDS } from '../constants/home.constants'
import { DashboardCardComponent } from './DashboardCard'
import type { UserRole } from '@/config/routing'

interface DashboardCardsProps {
  darkMode: boolean
  role?: UserRole
}

export function DashboardCards({ darkMode, role }: DashboardCardsProps) {
  const router = useRouter()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)

  const handleCardNavigate = useCallback((href: string) => {
    setLoadingHref(href)
    router.push(href)
  }, [router])

  const visibleCards =
    role === 'cajero'
      ? DASHBOARD_CARDS.filter((card) => card.icon === 'pos' || card.icon === 'mesas')
      : DASHBOARD_CARDS

  const topRow = visibleCards.slice(0, 3)
  const bottomRow = visibleCards.slice(3)

  return (
    <section className="max-w-6xl mx-auto space-y-8 px-3 md:px-0">
      {/* First row: up to 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {topRow.map((card) => (
          <DashboardCardComponent
            key={card.title}
            card={card}
            darkMode={darkMode}
            isGlobalLoading={loadingHref !== null}
            isThisCardLoading={loadingHref === card.href}
            onNavigateStart={handleCardNavigate}
          />
        ))}
      </div>

      {/* Second row: remaining cards centered */}
      {bottomRow.length > 0 && (
        <div className="flex flex-wrap justify-center gap-8">
          {bottomRow.map((card) => (
            <div key={card.title} className="w-full md:flex-1 md:min-w-[280px] md:max-w-[362px]">
              <DashboardCardComponent
                card={card}
                darkMode={darkMode}
                isGlobalLoading={loadingHref !== null}
                isThisCardLoading={loadingHref === card.href}
                onNavigateStart={handleCardNavigate}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
