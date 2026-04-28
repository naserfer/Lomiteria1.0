'use client'

import { useHomeAuth } from '../hooks/useHomeAuth'
import { HomeHeader } from '../components/HomeHeader'
import { DashboardCards } from '../components/DashboardCards'
import { FeaturesList } from '../components/FeaturesList'
import { HomeLoading } from '../components/HomeLoading'
import type { UserRole } from '@/config/routing'

export default function HomeView() {
  const { tenant, usuario, darkMode, loading, isAuthenticated } = useHomeAuth()

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
    <div className="h-full flex flex-col justify-center space-y-16 py-8">
      <HomeHeader tenantInfo={tenantInfo} darkMode={darkMode} />
      <DashboardCards darkMode={darkMode} role={role} />
      {/* <FeaturesList darkMode={darkMode} /> */}
    </div>
  )
}
