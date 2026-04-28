'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Table2,
  CalendarClock,
  GitMerge,
  SplitSquareHorizontal,
  ShoppingCart,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { toggleGestionMesas } from '@/app/actions/tenant'
import { ROUTES } from '@/config/routes'

interface ActivarMesasModalProps {
  onClose: () => void
}

const FEATURES = [
  {
    icon: Table2,
    title: 'Mapa visual del salón',
    description: 'Creá tus mesas, asignales alias y visualizá en tiempo real cuáles están libres, ocupadas o reservadas.',
  },
  {
    icon: ShoppingCart,
    title: 'Pedidos vinculados a mesa',
    description: 'Tomá el pedido directamente desde la mesa y el POS lo registra con la mesa asociada automáticamente.',
  },
  {
    icon: CalendarClock,
    title: 'Gestión de reservas',
    description: 'Registrá reservas con nombre, teléfono y horario. Visualizalas en la tarjeta de cada mesa el día que corresponda.',
  },
  {
    icon: GitMerge,
    title: 'Unión de mesas',
    description: 'Juntá varias mesas para grupos grandes con un solo click. Cerrá la unión cuando terminen.',
  },
  {
    icon: SplitSquareHorizontal,
    title: 'División de cuenta',
    description: 'Dividí el total de una mesa en partes iguales para que cada cliente pague lo suyo.',
  },
]

export function ActivarMesasModal({ onClose }: ActivarMesasModalProps) {
  const router = useRouter()
  const { reloadTenant } = useTenant()
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  // Portal solo disponible en el cliente
  useEffect(() => { setMounted(true) }, [])

  const handleActivar = async () => {
    setActivating(true)
    setError('')
    const result = await toggleGestionMesas(true)
    if (result.error) {
      setError(result.error)
      setActivating(false)
      return
    }
    await reloadTenant()
    onClose()
    router.push(ROUTES.PROTECTED.MESAS)
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activar-mesas-title"
      style={{
        paddingTop:    'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft:   'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight:  'max(1rem, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — flex column con altura máxima para no superar el viewport */}
      <div
        className="relative w-full max-w-xl flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '100%' }}
      >
        {/* ── Header gradiente (fijo, no scrollea) ── */}
        <div className="shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 px-6 pt-8 pb-10">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex p-3 bg-white/20 rounded-2xl">
              <Table2 className="w-7 h-7 text-white" />
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
              <Sparkles className="w-3 h-3" />
              Módulo opcional
            </span>
          </div>

          <h2 id="activar-mesas-title" className="text-2xl font-black text-white leading-tight">
            Gestión de Mesas
          </h2>
          <p className="text-white/80 text-sm mt-2 leading-relaxed">
            Organizá tu salón, tomá pedidos por mesa y controlá la ocupación de tu local — todo desde un solo panel, sin interrumpir tu flujo de caja.
          </p>
        </div>

        {/* ── Cuerpo scrollable ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain -mt-4 bg-white dark:bg-gray-900 rounded-t-3xl relative z-10 px-6 pt-5 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
            ¿Qué podés hacer?
          </p>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 inline-flex p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer fijo con botones (no scrollea) ── */}
        <div className="shrink-0 bg-white dark:bg-gray-900 px-6 pt-4 pb-5 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleActivar}
              disabled={activating}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition text-sm"
            >
              {activating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Activando…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Activar gestión de mesas
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={activating}
              className="sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
            >
              Ahora no
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
            Podés desactivar este módulo en cualquier momento desde Configuración.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}
