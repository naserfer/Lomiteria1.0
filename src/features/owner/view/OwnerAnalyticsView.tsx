'use client'

import Link from 'next/link'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import type { OwnerGa4Dashboard } from '@/lib/analytics/ga4OwnerReports'
import { useTenant } from '@/contexts/TenantContext'
import { ROUTES } from '@/config/routes'
import { Activity, ExternalLink, Eye, Timer, UserPlus, Users } from 'lucide-react'

type Props =
  | { status: 'ok'; dashboard: OwnerGa4Dashboard }
  | { status: 'not_configured'; hint: string }
  | { status: 'error'; message: string }

function formatInt(n: number): string {
  return new Intl.NumberFormat('es-PY').format(Math.round(n))
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}m ${s}s`
}

function backToOwnerLinkClass(darkMode: boolean): string {
  return `inline-flex w-full items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition sm:w-auto sm:py-2.5 ${
    darkMode
      ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-800/90'
      : 'border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
  }`
}

/**
 * El `main` de AppFrame ya aplica `px-4`; estos valores suman lo que falte respecto al notch /
 * Dynamic Island / home indicator (iPhone y similares).
 */
const SAFE_INSET_SHELL =
  'pl-[max(0px,calc(env(safe-area-inset-left,0px)-1rem))] pr-[max(0px,calc(env(safe-area-inset-right,0px)-1rem))] pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))]'

export function OwnerAnalyticsView(props: Props) {
  const { darkMode } = useTenant()
  const card = `rounded-xl border p-4 sm:p-5 ${
    darkMode
      ? 'border-slate-700/80 bg-slate-900/40 text-slate-100'
      : 'border-slate-200 bg-white text-slate-900 shadow-sm'
  }`
  const muted = darkMode ? 'text-slate-400' : 'text-slate-600'
  const tableHead = darkMode ? 'text-slate-400' : 'text-slate-600'
  const rowBorder = darkMode ? 'border-slate-700/60' : 'border-slate-200'
  const theadBg = darkMode ? 'bg-slate-800/70' : 'bg-slate-50'
  const rowHover = darkMode ? 'hover:bg-slate-800/35' : 'hover:bg-slate-50/80'
  const kpiAccent =
    'border-l-4 border-l-emerald-500 pl-4 dark:border-l-emerald-400'

  if (props.status === 'not_configured') {
    return (
      <div className={`w-full space-y-6 ${SAFE_INSET_SHELL}`}>
        <div className={card}>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Conectá Google Analytics 4
          </h1>
          <p className={`mt-1 text-xs font-medium uppercase tracking-wide ${tableHead}`}>
            Analytics de la landing pública
          </p>
          <p className={`mt-2 text-sm ${muted}`}>
            Google Analytics 4 no está conectado al panel todavía. Cuando configures las variables de
            entorno, acá vas a ver usuarios, sesiones, páginas vistas, fuentes de tráfico y dispositivos.
          </p>
          <ol className={`mt-4 list-decimal space-y-2 pl-5 text-sm ${muted}`}>
            <li>
              Creá una propiedad GA4 y un flujo web con la URL de producción (ej.{' '}
              <code className="rounded bg-black/10 px-1 py-0.5 text-xs">https://tudominio.com</code>).
            </li>
            <li>
              Instalá el tag de GA4 (por ejemplo con Google Tag Manager en todo el sitio, ya integrado en el layout).
            </li>
            <li>
              En Google Cloud, creá una cuenta de servicio con acceso a la API “Google Analytics Data API”,
              descargá la clave JSON y pegá el JSON completo (una línea) en{' '}
              <code className="rounded bg-black/10 px-1 py-0.5 text-xs">GA4_SERVICE_ACCOUNT_JSON</code>.
            </li>
            <li>
              En GA4 → Administrar → acceso a la propiedad, agregá el email de la cuenta de servicio con rol{' '}
              <strong>Lector</strong> o superior.
            </li>
            <li>
              El ID numérico de la propiedad va en{' '}
              <code className="rounded bg-black/10 px-1 py-0.5 text-xs">GA4_PROPERTY_ID</code> (solo números, o{' '}
              <code className="rounded bg-black/10 px-1 py-0.5 text-xs">properties/123...</code>).
            </li>
          </ol>
          <p className={`mt-4 text-xs ${muted}`}>{props.hint}</p>
        </div>
        <Link href={ROUTES.PROTECTED.OWNER} className={backToOwnerLinkClass(darkMode)}>
          Ir al panel Owner
        </Link>
      </div>
    )
  }

  if (props.status === 'error') {
    return (
      <div className={`w-full space-y-4 ${SAFE_INSET_SHELL}`}>
        <div className={`${card} border-red-300/50 dark:border-red-900/50`}>
          <h1 className="text-xl font-bold tracking-tight text-red-700 dark:text-red-400 sm:text-2xl">
            No pudimos cargar GA4
          </h1>
          <p className={`mt-1 text-xs font-medium uppercase tracking-wide ${tableHead}`}>Analytics landing</p>
          <p className={`mt-2 text-sm ${muted}`}>{props.message}</p>
        </div>
        <Link href={ROUTES.PROTECTED.OWNER} className={backToOwnerLinkClass(darkMode)}>
          Ir al panel Owner
        </Link>
      </div>
    )
  }

  const { dashboard: d } = props
  const axisColor = darkMode ? '#94a3b8' : '#64748b'
  const gridColor = darkMode ? '#334155' : '#e2e8f0'
  const lineColor = darkMode ? '#38bdf8' : '#0284c7'
  const deviceTotalSessions = d.devices.reduce((sum, row) => sum + row.sessions, 0)

  const ga4ButtonClass = `inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition sm:w-auto sm:px-3 sm:py-2 ${
    darkMode
      ? 'border-slate-600 bg-slate-800 hover:bg-slate-800/90'
      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
  }`

  return (
    <div className={`w-full space-y-6 sm:space-y-8 ${SAFE_INSET_SHELL}`}>
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Tráfico de la landing pública
            </h1>
            <p className={`text-xs font-medium uppercase tracking-wide ${tableHead}`}>Google Analytics 4 · últimos 28 días</p>
            <p className={`max-w-2xl text-sm leading-relaxed ${muted}`}>
              Misma propiedad que el tag en la home (<code className="text-xs">/</code>). Para informes avanzados
              abrí la consola de Google.
            </p>
          </div>
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={ga4ButtonClass}
          >
            Abrir GA4
            <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </a>
        </div>
      </header>

      {d.realtimeActiveUsers !== null && (
        <div
          className={`rounded-xl border px-3 py-3 text-sm shadow-sm sm:px-4 sm:py-3.5 ${
            darkMode
              ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-100'
              : 'border-emerald-200/90 bg-emerald-50 text-emerald-900'
          }`}
        >
          <span className="font-semibold">Ahora mismo:</span>{' '}
          {formatInt(d.realtimeActiveUsers)} usuario(s) activo(s) (tiempo real GA4).
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${card} ${kpiAccent}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium uppercase tracking-wide ${tableHead}`}>Usuarios activos</p>
            <Users className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatInt(d.summary.activeUsers)}</p>
          <p className={`text-xs ${muted}`}>últimos 28 días</p>
        </div>
        <div className={`${card} ${kpiAccent}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium uppercase tracking-wide ${tableHead}`}>Sesiones</p>
            <Activity className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatInt(d.summary.sessions)}</p>
          <p className={`text-xs ${muted}`}>últimos 28 días</p>
        </div>
        <div className={`${card} ${kpiAccent}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium uppercase tracking-wide ${tableHead}`}>Vistas de página</p>
            <Eye className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatInt(d.summary.screenPageViews)}</p>
          <p className={`text-xs ${muted}`}>últimos 28 días</p>
        </div>
        <div className={`${card} ${kpiAccent}`}>
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium uppercase tracking-wide ${tableHead}`}>Usuarios nuevos</p>
            <UserPlus className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatInt(d.summary.newUsers)}</p>
          <p className={`text-xs ${muted}`}>últimos 28 días</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <section className={`${card} ${kpiAccent} flex flex-col justify-center lg:col-span-1`}>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold">Duración media de sesión</h2>
            <Timer className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums">{formatDuration(d.summary.averageSessionDurationSec)}</p>
          <p className={`mt-1 text-xs ${muted}`}>últimos 28 días</p>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <h2 className="text-lg font-semibold">Usuarios activos por día</h2>
          <p className={`mb-4 text-xs ${muted}`}>Últimos 14 días</p>
          <div className="h-52 w-full min-w-0 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.dailyActiveUsers} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="dateLabel" tick={{ fill: axisColor, fontSize: 11 }} />
                <YAxis tick={{ fill: axisColor, fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: darkMode ? '#0f172a' : '#fff',
                    border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: axisColor }}
                />
                <Line type="monotone" dataKey="activeUsers" name="Activos" stroke={lineColor} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-semibold">Páginas más vistas</h2>
          <p className={`mb-3 text-xs ${muted}`}>Últimos 28 días</p>
          <div className={`overflow-hidden rounded-lg border ${rowBorder}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={theadBg}>
                  <tr className={`border-b ${rowBorder}`}>
                    <th className={`px-3 py-2.5 pr-2 text-xs font-semibold uppercase tracking-wide ${tableHead}`}>
                      Ruta
                    </th>
                    <th
                      className={`px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide ${tableHead}`}
                    >
                      Vistas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.topPages.length === 0 ? (
                    <tr>
                      <td colSpan={2} className={`px-3 py-6 ${muted}`}>
                        Sin datos aún.
                      </td>
                    </tr>
                  ) : (
                    d.topPages.map((row) => (
                      <tr key={row.path} className={`border-b ${rowBorder} last:border-0 ${rowHover} transition-colors`}>
                        <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-xs sm:max-w-xs" title={row.path}>
                          {row.path}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatInt(row.views)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-semibold">Tráfico por origen / medio</h2>
          <p className={`mb-3 text-xs ${muted}`}>Últimos 28 días</p>
          <div className={`overflow-hidden rounded-lg border ${rowBorder}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={theadBg}>
                  <tr className={`border-b ${rowBorder}`}>
                    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide ${tableHead}`}>Origen</th>
                    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide ${tableHead}`}>Medio</th>
                    <th
                      className={`px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide ${tableHead}`}
                    >
                      Sesiones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.trafficSources.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={`px-3 py-6 ${muted}`}>
                        Sin datos aún.
                      </td>
                    </tr>
                  ) : (
                    d.trafficSources.map((row) => (
                      <tr
                        key={`${row.source}|${row.medium}`}
                        className={`border-b ${rowBorder} last:border-0 ${rowHover} transition-colors`}
                      >
                        <td className="max-w-[120px] truncate px-3 py-2.5" title={row.source}>
                          {row.source}
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2.5" title={row.medium}>
                          {row.medium}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatInt(row.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section className={card}>
        <h2 className="text-lg font-semibold">Dispositivos</h2>
        <p className={`mb-4 text-xs ${muted}`}>Sesiones por categoría — últimos 28 días</p>
        {d.devices.length === 0 ? (
          <span className={muted}>Sin datos.</span>
        ) : (
          <ul className="space-y-4">
            {d.devices.map((row) => {
              const pct =
                deviceTotalSessions > 0 ? Math.round((row.sessions / deviceTotalSessions) * 1000) / 10 : 0
              return (
                <li key={row.category}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium capitalize">{row.category}</span>
                    <span className="tabular-nums text-sm text-slate-600 dark:text-slate-400">
                      {formatInt(row.sessions)} <span className="text-xs font-normal">sesiones</span>
                      <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">({pct}%)</span>
                    </span>
                  </div>
                  <div
                    className={`h-2 overflow-hidden rounded-full ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width] dark:bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
