'use client'

import { useHomeAuth } from '../hooks/useHomeAuth'
import { HomeHeader } from '../components/HomeHeader'
import { DashboardCards } from '../components/DashboardCards'
import { FeaturesList } from '../components/FeaturesList'
import { HomeLoading } from '../components/HomeLoading'
import { useTenant } from '@/contexts/TenantContext'
import type { UserRole } from '@/config/routing'

export default function HomeView() {
  const { tenant, usuario, darkMode, loading, isAuthenticated } = useHomeAuth()
  const { hasMesas } = useTenant()

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <HomeLoading />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const tenantInfo = {
    nombre: tenant?.nombre ?? 'Ka\'u Manager',
    usuario: usuario?.nombre
  }
  const role = usuario?.rol as UserRole | undefined

  return (
    <div className="min-h-full flex flex-col gap-10 py-6 sm:py-8">
      <HomeHeader tenantInfo={tenantInfo} darkMode={darkMode} />
      <DashboardCards darkMode={darkMode} role={role} hasMesas={hasMesas} />
      {/* <FeaturesList darkMode={darkMode} /> */}
    </div>
  )
}
