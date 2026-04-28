'use client'

import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  BarChart3,
  FileText,
  Users,
  ChefHat,
  Table2,
  Loader2,
  Store,
  Wallet,
} from 'lucide-react'

export type AppDashboardCardColor = 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'amber'

export type AppDashboardCardIcon =
  | 'pos'
  | 'admin'
  | 'pedidos'
  | 'clientes'
  | 'cocina'
  | 'mesas'
  | 'stores'
  | 'wallet'

const APP_CARD_ICONS: Record<AppDashboardCardIcon, React.ComponentType<{ className?: string }>> = {
  pos: ShoppingCart,
  admin: BarChart3,
  pedidos: FileText,
  clientes: Users,
  cocina: ChefHat,
  mesas: Table2,
  stores: Store,
  wallet: Wallet,
}

const COLOR_MAP: Record<
  AppDashboardCardColor,
  {
    shadow: string
    bgLight: string
    blob: string
    iconBgLight: string
    iconBgDark: string
    iconLight: string
    iconDark: string
    barLight: string
    barDark: string
    ring: string
  }
> = {
  orange: {
    shadow: 'hover:shadow-orange-500/20',
    bgLight: 'bg-gradient-to-br from-white to-orange-50',
    blob: 'bg-orange-500/10',
    iconBgLight: 'bg-orange-100',
    iconBgDark: 'bg-orange-500/20',
    iconLight: 'text-orange-600',
    iconDark: 'text-orange-400',
    barLight: 'bg-orange-500',
    barDark: 'bg-orange-500/50',
    ring: 'ring-orange-500',
  },
  green: {
    shadow: 'hover:shadow-emerald-500/20',
    bgLight: 'bg-gradient-to-br from-white to-emerald-50',
    blob: 'bg-emerald-500/10',
    iconBgLight: 'bg-emerald-100',
    iconBgDark: 'bg-emerald-500/20',
    iconLight: 'text-emerald-600',
    iconDark: 'text-emerald-400',
    barLight: 'bg-emerald-500',
    barDark: 'bg-emerald-500/50',
    ring: 'ring-emerald-500',
  },
  blue: {
    shadow: 'hover:shadow-blue-500/20',
    bgLight: 'bg-gradient-to-br from-white to-blue-50',
    blob: 'bg-blue-500/10',
    iconBgLight: 'bg-blue-100',
    iconBgDark: 'bg-blue-500/20',
    iconLight: 'text-blue-600',
    iconDark: 'text-blue-400',
    barLight: 'bg-blue-500',
    barDark: 'bg-blue-500/50',
    ring: 'ring-blue-500',
  },
  purple: {
    shadow: 'hover:shadow-purple-500/20',
    bgLight: 'bg-gradient-to-br from-white to-purple-50',
    blob: 'bg-purple-500/10',
    iconBgLight: 'bg-purple-100',
    iconBgDark: 'bg-purple-500/20',
    iconLight: 'text-purple-600',
    iconDark: 'text-purple-400',
    barLight: 'bg-purple-500',
    barDark: 'bg-purple-500/50',
    ring: 'ring-purple-500',
  },
  red: {
    shadow: 'hover:shadow-red-500/20',
    bgLight: 'bg-gradient-to-br from-white to-red-50',
    blob: 'bg-red-500/10',
    iconBgLight: 'bg-red-100',
    iconBgDark: 'bg-red-500/20',
    iconLight: 'text-red-600',
    iconDark: 'text-red-400',
    barLight: 'bg-red-500',
    barDark: 'bg-red-500/50',
    ring: 'ring-red-500',
  },
  amber: {
    shadow: 'hover:shadow-amber-500/20',
    bgLight: 'bg-gradient-to-br from-white to-amber-50',
    blob: 'bg-amber-500/10',
    iconBgLight: 'bg-amber-100',
    iconBgDark: 'bg-amber-500/20',
    iconLight: 'text-amber-600',
    iconDark: 'text-amber-400',
    barLight: 'bg-amber-500',
    barDark: 'bg-amber-500/50',
    ring: 'ring-amber-500',
  },
}

export interface AppDashboardCardProps {
  title: string
  description: string
  href: string
  icon: AppDashboardCardIcon
  color: AppDashboardCardColor
  label: string
  darkMode: boolean
  isGlobalLoading?: boolean
  isThisCardLoading?: boolean
  onNavigateStart?: (href: string) => void
}

export function AppDashboardCard({
  title,
  description,
  href,
  icon,
  color,
  label,
  darkMode,
  isGlobalLoading = false,
  isThisCardLoading = false,
  onNavigateStart,
}: AppDashboardCardProps) {
  const router = useRouter()
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue
  const Icon = APP_CARD_ICONS[icon]

  const bgCls = darkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : c.bgLight
  const isDisabled = isGlobalLoading && !isThisCardLoading
  const blobCls = darkMode ? c.blob.replace('500/10', '500/20') : c.blob

  const handleMouseEnter = () => {
    if (icon === 'cocina') router.prefetch(href)
  }

  const handleClick = () => {
    if (isGlobalLoading) return
    onNavigateStart?.(href)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      disabled={isDisabled}
      className={`
        group relative rounded-3xl shadow-2xl transition-all duration-300 text-left w-full
        block h-full
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        ${isDisabled ? 'pointer-events-none opacity-60 cursor-not-allowed scale-100' : 'hover:-translate-y-1 hover:scale-[1.02] cursor-pointer active:scale-[1.01]'}
        ${!isDisabled ? c.shadow : ''}
        ${bgCls}
        ${isThisCardLoading ? `ring-2 ring-offset-2 ring-offset-transparent ${c.ring}` : ''}
        min-w-0
      `}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-busy={isThisCardLoading}
      aria-disabled={isDisabled}
    >
      {isThisCardLoading && (
        <span
          role="status"
          aria-live="polite"
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl ${
            darkMode ? 'bg-gray-900/80' : 'bg-white/85'
          } backdrop-blur-sm transition-opacity duration-200`}
        >
          <Loader2
            className={`w-10 h-10 animate-spin ${darkMode ? c.iconDark : c.iconLight}`}
            aria-hidden
          />
          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Cargando…
          </span>
        </span>
      )}

      <span className="relative block h-full overflow-hidden rounded-3xl">
        <span
          className={`absolute top-0 right-0 w-40 h-40 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500 ${blobCls}`}
        />
        <span className="relative block p-8 space-y-4">
          <span className={`inline-flex p-4 rounded-2xl ${darkMode ? c.iconBgDark : c.iconBgLight}`}>
            <Icon className={`w-8 h-8 ${darkMode ? c.iconDark : c.iconLight}`} />
          </span>
          <span className="block">
            <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h3>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {description}
            </p>
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm font-semibold ${
              darkMode ? c.iconDark : c.iconLight
            }`}
          >
            {label}
          </span>
        </span>
        <span className={`absolute bottom-0 left-0 right-0 h-2 ${darkMode ? c.barDark : c.barLight}`} />
      </span>
    </button>
  )
}

