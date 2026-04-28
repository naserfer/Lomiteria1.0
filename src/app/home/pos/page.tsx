import { Suspense } from 'react'
import POSPageClient from './POSPageClient'

// Suspense requerido por useSearchParams en POSPageClient.
// Página síncrona para evitar round-trip RSC; verificación de rol en el cliente.
export default function POSPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <POSPageClient />
    </Suspense>
  )
}
