'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { DASHBOARD_CARDS } from '../constants/home.constants'
import { DashboardCardComponent } from './DashboardCard'
import { ActivarMesasModal } from '@/features/mesas/components/ActivarMesasModal'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES } from '@/config/routes'
import type { UserRole } from '@/config/routing'

interface DashboardCardsProps {
  darkMode: boolean
  role?: UserRole
  hasMesas?: boolean
}

export function DashboardCards({ darkMode, role, hasMesas = false }: DashboardCardsProps) {
  const router = useRouter()
  const { isAdmin } = useTenant()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)
  const [showActivarModal, setShowActivarModal] = useState(false)

  const handleCardNavigate = useCallback((href: string) => {
    // Si el admin toca la card de mesas con el módulo desactivado → modal de onboarding
    if (href === ROUTES.PROTECTED.MESAS && !hasMesas && isAdmin) {
      setShowActivarModal(true)
      return
    }
    setLoadingHref(href)
    router.push(href)
  }, [router, hasMesas, isAdmin])

  // Admins ven la card de mesas siempre (para poder activar el módulo).
  // No-admins solo la ven si el módulo ya está activo.
  const roleFiltered =
    role === 'cajero'
      ? DASHBOARD_CARDS.filter((card) => card.icon === 'pos' || card.icon === 'mesas')
      : DASHBOARD_CARDS

  const visibleCards = roleFiltered.filter((card) => {
    if (card.icon !== 'mesas') return true
    return hasMesas || isAdmin
  })

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-3 pb-6 md:px-0">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => (
            <div key={card.title} className="h-full">
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
      </section>

      {showActivarModal && (
        <ActivarMesasModal onClose={() => setShowActivarModal(false)} />
      )}
    </>
  )
}
