'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTenant } from '@/contexts/TenantContext'
import { getUnauthorizedRedirect } from '@/config/routing'
import type { UserRole } from '@/config/routing'

const MesasView = dynamic(() => import('@/features/mesas/view/MesasView'), {
  loading: () => (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Cargando panel de mesas...</p>
      </div>
    </div>
  ),
  ssr: false,
})

const ALLOWED_MESAS_ROLES: UserRole[] = ['admin', 'cajero', 'repartidor']

export default function MesasPageClient() {
  const router = useRouter()
  const { tenant, usuario, loading: tenantLoading } = useTenant()

  useEffect(() => {
    if (tenantLoading) return
    if (!tenant) {
      router.replace('/')
      return
    }
    const rol = usuario?.rol as UserRole | undefined
    if (!rol || !ALLOWED_MESAS_ROLES.includes(rol)) {
      router.replace(getUnauthorizedRedirect(rol ?? 'cajero'))
    }
  }, [tenant, tenantLoading, usuario?.rol, router])

  if (tenantLoading || !tenant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const rol = usuario?.rol as UserRole | undefined
  if (!rol || !ALLOWED_MESAS_ROLES.includes(rol)) return null

  return <MesasView />
}
