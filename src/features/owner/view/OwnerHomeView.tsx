'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { AppDashboardCard } from '@/features/common/components/AppDashboardCard'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES } from '@/config/routes'

const OWNER_CARDS = [
  {
    title: 'Analytics Landing',
    description: 'Usuarios, sesiones, páginas vistas y fuentes de tráfico de la home pública.',
    href: ROUTES.PROTECTED.OWNER_ANALYTICS,
    icon: 'admin' as const,
    color: 'green' as const,
    label: 'Ver métricas',
  },
  {
    title: 'Lomiterías registradas',
    description: 'Alta, baja y gestión de todas las lomiterías dentro de Karubox.',
    href: '/owner/tenants',
    icon: 'stores' as const,
    color: 'blue' as const,
    label: 'Ver lomiterías',
  },
  {
    title: 'Analytics Landing',
    description: 'Tráfico de la landing pública: usuarios, sesiones, páginas vistas y fuentes (GA4).',
    href: '/owner/analytics',
    icon: 'admin' as const,
    color: 'green' as const,
    label: 'Ver analytics',
  },
  {
    title: 'Caja de socios',
    description: 'Lista simple de cosas a pagar entre Naser e Iván.',
    href: '/owner/caja',
    icon: 'wallet' as const,
    color: 'purple' as const,
    label: 'Ver caja de socios',
  },
]

export function OwnerHomeView() {
  const router = useRouter()
  const { darkMode } = useTenant()
  const [loadingHref, setLoadingHref] = useState<string | null>(null)

  const handleNavigate = useCallback(
    (href: string) => {
      setLoadingHref(href)
      router.push(href)
    },
    [router]
  )

  return (
    <div className="h-full flex flex-col justify-center py-8 overflow-visible">
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 px-4 pb-6 md:px-0 overflow-visible">
        {OWNER_CARDS.map((card) => (
          <AppDashboardCard
            key={card.href}
            title={card.title}
            description={card.description}
            href={card.href}
            icon={card.icon}
            color={card.color}
            label={card.label}
            darkMode={darkMode}
            isGlobalLoading={loadingHref !== null}
            isThisCardLoading={loadingHref === card.href}
            onNavigateStart={handleNavigate}
          />
        ))}
      </section>
    </div>
  )
}

