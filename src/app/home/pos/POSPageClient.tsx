'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTenant } from '@/contexts/TenantContext'
import { MesaPickerScreen } from '@/features/pos/components/MesaPickerScreen'
import { getUnauthorizedRedirect } from '@/config/routing'
import type { UserRole } from '@/config/routing'

const POSView = dynamic(() => import('@/features/pos/view/POSView'), {
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Cargando punto de venta...</p>
      </div>
    </div>
  ),
  ssr: false,
})

const ALLOWED_POS_ROLES: UserRole[] = ['admin', 'cajero', 'repartidor']

// Roles que ven el mesa picker. Repartidor siempre hace delivery — va directo al POS.
const MESA_PICKER_ROLES: UserRole[] = ['admin', 'cajero']

export default function POSPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tenant, usuario, loading: tenantLoading, hasMesas } = useTenant()

  // true cuando el usuario eligió explícitamente "sin mesa" en el picker.
  // Se resetea al remontar (nueva visita al POS = nueva elección de mesa).
  const [bypassPicker, setBypassPicker] = useState(false)

  const mesaId = searchParams.get('mesaId')
  const rol = usuario?.rol as UserRole | undefined

  useEffect(() => {
    if (tenantLoading) return
    if (!tenant) {
      router.replace('/')
      return
    }
    if (!rol || !ALLOWED_POS_ROLES.includes(rol)) {
      router.replace(getUnauthorizedRedirect(rol ?? 'cajero'))
    }
  }, [tenant, tenantLoading, rol, router])

  // ── Carga inicial ──────────────────────────────────────────────────────────
  if (tenantLoading || !tenant) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!rol || !ALLOWED_POS_ROLES.includes(rol)) return null

  // ── Mesa picker ────────────────────────────────────────────────────────────
  // Mostrar cuando:
  //   • el tenant tiene gestion_mesas activo
  //   • no llega ya una mesa preseleccionada desde la URL (ej: botón "Tomar pedido" de MesasView)
  //   • el usuario no eligió explícitamente "sin mesa"
  //   • el rol accede a mesas (repartidor siempre hace delivery → skip)
  const shouldShowPicker =
    hasMesas &&
    !mesaId &&
    !bypassPicker &&
    MESA_PICKER_ROLES.includes(rol)

  if (shouldShowPicker) {
    return (
      <MesaPickerScreen
        tenantId={tenant.id}
        onSinMesa={() => setBypassPicker(true)}
      />
    )
  }

  return <POSView />
}
