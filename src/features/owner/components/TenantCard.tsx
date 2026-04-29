import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Package, Mail, Phone, MapPin, Eye, Loader2, Trash2 } from 'lucide-react'
import { toggleTenantStatus } from '@/app/actions/owner'
import { DeleteTenantModal } from '@/features/owner/components/DeleteTenantModal'
import { canPurgeTenant } from '@/lib/owner/tenantDeletionGuard'
import { ROUTES } from '@/config/routes'

type LoadingAction = 'detalle' | 'gestionar' | 'toggle' | null

interface Tenant {
  id: string
  nombre: string
  slug: string
  ruc: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  logo_url: string | null
  activo: boolean
  created_at: string
  usuarios: { count: number }[]
}

interface TenantCardProps {
  tenant: Tenant
  onStatusChange: () => void
}

export function TenantCard({ tenant, onStatusChange }: TenantCardProps) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const deletable = canPurgeTenant({ id: tenant.id, slug: tenant.slug })

  const usuariosCount = tenant.usuarios?.[0]?.count ?? 0
  const fechaCreacion = new Date(tenant.created_at).toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const handleDetalle = () => {
    setLoadingAction('detalle')
    router.push(`/owner/tenants/${tenant.id}`)
  }

  const handleGestionar = () => {
    setLoadingAction('gestionar')
    router.push(`/owner/tenants/${tenant.id}/productos?name=${encodeURIComponent(tenant.nombre)}`)
  }

  const handleToggle = async () => {
    setLoadingAction('toggle')
    await toggleTenantStatus(tenant.id, !tenant.activo)
    setLoadingAction(null)
    onStatusChange()
  }

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm hover:shadow-md transition-all duration-200 p-5 flex flex-col gap-4 ${
        tenant.activo
          ? 'border-green-400 dark:border-green-500'
          : 'border-red-400 dark:border-red-500'
      }`}
    >
      {/* Indicador de estado superior */}
      <div
        className={`absolute top-0 left-4 right-4 h-1 rounded-b-full ${
          tenant.activo ? 'bg-green-400 dark:bg-green-500' : 'bg-red-400 dark:bg-red-500'
        }`}
      />

      {/* Header de la card */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          {tenant.logo_url && (
            <Image
              src={tenant.logo_url}
              alt={`Logo de ${tenant.nombre}`}
              width={40}
              height={40}
              unoptimized
              className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
              {tenant.nombre}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-mono">/{tenant.slug}</p>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            tenant.activo
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              tenant.activo ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          {tenant.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Datos */}
      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
        {tenant.ruc && (
          <p className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-gray-500">RUC:</span> {tenant.ruc}
          </p>
        )}
        {tenant.email && (
          <p className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="truncate">{tenant.email}</span>
          </p>
        )}
        {tenant.telefono && (
          <p className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
            {tenant.telefono}
          </p>
        )}
        {tenant.direccion && (
          <p className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="truncate">{tenant.direccion}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-500">Usuarios:</span> {usuariosCount}
        </p>
        <p className="flex items-center gap-2">
          <span className="text-gray-400 dark:text-gray-500">Creado:</span> {fechaCreacion}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2 mt-auto">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDetalle}
            disabled={loadingAction !== null}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-center transition bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          >
            {loadingAction === 'detalle' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {loadingAction === 'detalle' ? 'Cargando...' : 'Detalle'}
          </button>
          <button
            type="button"
            onClick={handleGestionar}
            disabled={loadingAction !== null}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-center transition bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-700 inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          >
            {loadingAction === 'gestionar' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {loadingAction === 'gestionar' ? 'Cargando...' : 'Gestionar'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loadingAction !== null}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
            tenant.activo
              ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700'
              : 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700'
          }`}
        >
          {loadingAction === 'toggle' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : null}
          {loadingAction === 'toggle' ? 'Actualizando...' : tenant.activo ? 'Desactivar' : 'Activar'}
        </button>

        {/* {deletable && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={loadingAction !== null}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium transition border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4 shrink-0" aria-hidden />
            Eliminar local y todos sus datos
          </button>
        )} */}
      </div>

      <DeleteTenantModal
        open={showDeleteModal}
        tenant={{ id: tenant.id, nombre: tenant.nombre }}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false)
          router.push(ROUTES.PROTECTED.OWNER)
          onStatusChange()
        }}
      />
    </div>
  )
}
