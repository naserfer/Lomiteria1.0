'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTenant } from '@/contexts/TenantContext'
import { MesaPickerScreen } from '@/features/pos/components/MesaPickerScreen'
import { getUnauthorizedRedirect } from '@/config/routing'
import type { UserRole } from '@/config/routing'
import { ROUTES, posHrefWithMesaPhase } from '@/config/routes'

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

  const mesaId = searchParams.get('mesaId')
  const mesaPhaseParam = searchParams.get('mesaPhase')
  const rol = usuario?.rol as UserRole | undefined

  const isPickerRole = Boolean(rol && MESA_PICKER_ROLES.includes(rol))

  /** Local con mesas + admin/cajero + todavía sin mesa elegida → hace falta `mesaPhase` en la URL */
  const pickerGateActive =
    hasMesas && isPickerRole && !mesaId

  // Si debe mostrarse el gate y la URL no trae una fase válida, sincronizar a selección de mesa (breadcrumb + historial limpio).
  useEffect(() => {
    if (tenantLoading || !tenant) return
    if (!pickerGateActive) return

    const validPhase =
      mesaPhaseParam === ROUTES.POS_MESA_PHASE.PICKER ||
      mesaPhaseParam === ROUTES.POS_MESA_PHASE.SIN_MESA
    if (validPhase) return

    router.replace(posHrefWithMesaPhase(ROUTES.POS_MESA_PHASE.PICKER))
  }, [tenantLoading, tenant, pickerGateActive, mesaPhaseParam, router])

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

  if (pickerGateActive) {
    const syncedPhase =
      mesaPhaseParam === ROUTES.POS_MESA_PHASE.PICKER ||
      mesaPhaseParam === ROUTES.POS_MESA_PHASE.SIN_MESA
    if (!syncedPhase) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }
  }

  // ── Mesa picker ────────────────────────────────────────────────────────────
  // Mostrar cuando:
  //   • el tenant tiene gestion_mesas activo
  //   • no llega ya una mesa preseleccionada desde la URL (ej: botón "Tomar pedido" de MesasView)
  //   • `mesaPhase=picker` (no “sin mesa”)
  //   • el rol accede al selector (repartidor → skip)
  const shouldShowPicker =
    pickerGateActive &&
    mesaPhaseParam === ROUTES.POS_MESA_PHASE.PICKER

  if (shouldShowPicker) {
    return (
      <MesaPickerScreen
        tenantId={tenant.id}
        onSinMesa={() =>
          router.replace(posHrefWithMesaPhase(ROUTES.POS_MESA_PHASE.SIN_MESA))
        }
      />
    )
  }

  return <POSView />
}
