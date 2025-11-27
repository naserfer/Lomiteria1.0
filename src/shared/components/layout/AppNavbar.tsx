'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { LogOut, Menu, UserCircle2, Sun, Moon, BarChart3 } from 'lucide-react'
import { useTenant } from '@/features/auth/TenantContext'

interface AppNavbarProps {
  pageTitle: string
  pageSubtitle?: string
  actionsSlot?: ReactNode
}

export function AppNavbar({ pageTitle, pageSubtitle, actionsSlot }: AppNavbarProps) {
  const { tenant, usuario, signOut, darkMode, toggleDarkMode } = useTenant()

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur ${
        darkMode ? 'bg-gray-950/80 border-gray-800' : 'bg-white/80 border-orange-100'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/30">
            KM
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-orange-500">Ka&apos;u Manager</p>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
              <span className="font-semibold text-lg text-gray-900 dark:text-white">{pageTitle}</span>
              <Menu className="w-4 h-4 text-gray-400" />
              <span>{pageSubtitle}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Operando: <strong>{tenant?.nombre ?? '—'}</strong> • Usuario:{' '}
              <strong>{usuario?.nombre ?? '—'}</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {actionsSlot}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-500"
          >
            <BarChart3 className="w-4 h-4" />
            Panel general
          </Link>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-100 hover:scale-105 transition"
            aria-label="Cambiar tema"
          >
            {darkMode ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1 rounded-xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-4 py-2 text-sm font-semibold shadow"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">
            <UserCircle2 className="w-5 h-5 text-gray-400" />
            <div className="text-xs leading-tight">
              <p className="font-semibold text-gray-900 dark:text-white">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="text-gray-500 dark:text-gray-400">{tenant?.slug ?? ''}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

