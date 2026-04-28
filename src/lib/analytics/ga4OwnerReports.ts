import { BetaAnalyticsDataClient } from '@google-analytics/data'

export type Ga4Summary28d = {
  activeUsers: number
  sessions: number
  screenPageViews: number
  newUsers: number
  averageSessionDurationSec: number
}

export type Ga4DailyPoint = { dateLabel: string; activeUsers: number }

export type Ga4TopPage = { path: string; views: number }

export type Ga4SourceRow = { source: string; medium: string; sessions: number }

export type Ga4DeviceRow = { category: string; sessions: number }

export type OwnerGa4Dashboard = {
  summary: Ga4Summary28d
  dailyActiveUsers: Ga4DailyPoint[]
  topPages: Ga4TopPage[]
  trafficSources: Ga4SourceRow[]
  devices: Ga4DeviceRow[]
  realtimeActiveUsers: number | null
}

function getPropertyResource(): string | null {
  const raw = process.env.GA4_PROPERTY_ID?.trim()
  if (!raw) return null
  return raw.startsWith('properties/') ? raw : `properties/${raw}`
}

type Ga4Credentials = Record<string, unknown> & { private_key?: string }

function normalizeCredentials(value: unknown): Ga4Credentials | null {
  if (!value || typeof value !== 'object') return null
  const credentials: Ga4Credentials = { ...(value as Record<string, unknown>) }

  if (typeof credentials.private_key === 'string') {
    // Accept both real newlines and escaped "\n" from .env tooling.
    credentials.private_key = credentials.private_key
      .replace(/\r\n/g, '\n')
      .replace(/\\n/g, '\n')
  }

  return credentials
}

function getCredentialsJson(): object | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string') {
      return normalizeCredentials(JSON.parse(parsed) as unknown)
    }
    return normalizeCredentials(parsed)
  } catch {
    return null
  }
}

export function isGa4OwnerReportingConfigured(): boolean {
  return Boolean(getPropertyResource() && getCredentialsJson())
}

function getClient(): BetaAnalyticsDataClient | null {
  const property = getPropertyResource()
  const credentials = getCredentialsJson()
  if (!property || !credentials) return null
  return new BetaAnalyticsDataClient({ credentials })
}

function num(row: unknown, i: number): number {
  const mv = (row as { metricValues?: { value?: string | null }[] | null })?.metricValues
  const v = mv?.[i]?.value
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function dim(row: unknown, i: number): string {
  const dv = (row as { dimensionValues?: { value?: string | null }[] | null })?.dimensionValues
  return dv?.[i]?.value ?? ''
}

function formatGaDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd
  const y = yyyymmdd.slice(0, 4)
  const m = yyyymmdd.slice(4, 6)
  const d = yyyymmdd.slice(6, 8)
  return `${d}/${m}`
}

export async function fetchOwnerGa4Dashboard(): Promise<
  | { ok: true; data: OwnerGa4Dashboard }
  | { ok: false; code: 'not_configured' | 'api_error'; message: string }
> {
  const client = getClient()
  const property = getPropertyResource()
  if (!client || !property) {
    return { ok: false, code: 'not_configured', message: 'Faltan GA4_PROPERTY_ID o GA4_SERVICE_ACCOUNT_JSON.' }
  }

  try {
    const [
      summaryRes,
      dailyRes,
      pagesRes,
      trafficRes,
      devicesRes,
      realtimeRes,
    ] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'newUsers' },
          { name: 'averageSessionDuration' },
        ],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { orderType: 'ALPHANUMERIC', dimensionName: 'date' } }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ desc: true, metric: { metricName: 'screenPageViews' } }],
        limit: 12,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
        limit: 10,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
        limit: 8,
      }),
      client.runRealtimeReport({
        property,
        metrics: [{ name: 'activeUsers' }],
      }).catch(() => null),
    ])

    const s0 = summaryRes[0]?.rows?.[0]
    const summary: Ga4Summary28d = {
      activeUsers: num(s0, 0),
      sessions: num(s0, 1),
      screenPageViews: num(s0, 2),
      newUsers: num(s0, 3),
      averageSessionDurationSec: num(s0, 4),
    }

    const dailyActiveUsers: Ga4DailyPoint[] =
      dailyRes[0]?.rows?.map((row) => ({
        dateLabel: formatGaDate(dim(row, 0)),
        activeUsers: num(row, 0),
      })) ?? []

    const topPages: Ga4TopPage[] =
      pagesRes[0]?.rows?.map((row) => ({
        path: dim(row, 0) || '/',
        views: num(row, 0),
      })) ?? []

    const trafficSources: Ga4SourceRow[] =
      trafficRes[0]?.rows?.map((row) => ({
        source: dim(row, 0) || '(direct)',
        medium: dim(row, 1) || '(none)',
        sessions: num(row, 0),
      })) ?? []

    const devices: Ga4DeviceRow[] =
      devicesRes[0]?.rows?.map((row) => ({
        category: dim(row, 0) || 'unknown',
        sessions: num(row, 0),
      })) ?? []

    let realtimeActiveUsers: number | null = null
    if (realtimeRes) {
      const r0 = realtimeRes[0]?.rows?.[0]
      realtimeActiveUsers = r0 ? num(r0, 0) : 0
    }

    return {
      ok: true,
      data: {
        summary,
        dailyActiveUsers,
        topPages,
        trafficSources,
        devices,
        realtimeActiveUsers,
      },
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido al consultar GA4.'
    return { ok: false, code: 'api_error', message }
  }
}
