import { requireOwner } from '@/lib/auth/guard'
import { fetchOwnerGa4Dashboard, isGa4OwnerReportingConfigured } from '@/lib/analytics/ga4OwnerReports'
import { OwnerAnalyticsView } from '@/features/owner/view/OwnerAnalyticsView'

export default async function OwnerAnalyticsPage() {
  await requireOwner()

  if (!isGa4OwnerReportingConfigured()) {
    return (
      <OwnerAnalyticsView
        status="not_configured"
        hint="Revisá `.env.example` en el repo para los nombres exactos de las variables."
      />
    )
  }

  const result = await fetchOwnerGa4Dashboard()
  if (!result.ok) {
    return <OwnerAnalyticsView status="error" message={result.message} />
  }

  return <OwnerAnalyticsView status="ok" dashboard={result.data} />
}
