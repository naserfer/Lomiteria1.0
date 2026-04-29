import type { CreateTenantForm } from '../hooks/useCreateTenant'
import Image from 'next/image'

interface TenantFormProps {
  form: CreateTenantForm
  onChange: <K extends keyof CreateTenantForm>(field: K, value: CreateTenantForm[K]) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
  error: string
}

const inputClass =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 focus:outline-none transition bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const optionalClass = 'text-gray-400 dark:text-gray-500 font-normal'

export function TenantForm({ form, onChange, onSubmit, loading, error }: TenantFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="nombreNegocio" className={labelClass}>
          Nombre de la lomitería / restaurante
        </label>
        <input
          id="nombreNegocio"
          type="text"
          value={form.nombreNegocio}
          onChange={(e) => onChange('nombreNegocio', e.target.value)}
          required
          className={inputClass}
          placeholder="Ej: AtlasBurger"
          disabled={loading}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Se generará automáticamente un identificador único (slug) a partir del nombre.
        </p>
      </div>

      <div>
        <label htmlFor="ruc" className={labelClass}>
          RUC <span className={optionalClass}>(opcional)</span>
        </label>
        <input
          id="ruc"
          type="text"
          value={form.ruc}
          onChange={(e) => onChange('ruc', e.target.value)}
          className={inputClass}
          placeholder="80012345-6"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="razon_social" className={labelClass}>
          Razón social (para factura) <span className={optionalClass}>(opcional)</span>
        </label>
        <input
          id="razon_social"
          type="text"
          value={form.razon_social}
          onChange={(e) => onChange('razon_social', e.target.value)}
          className={inputClass}
          placeholder="Nombre completo del dueño o empresa"
          disabled={loading}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Si no se completa, en la factura se usará el nombre del negocio.
        </p>
      </div>

      <div>
        <label htmlFor="actividad_economica" className={labelClass}>
          Actividad económica <span className={optionalClass}>(opcional)</span>
        </label>
        <input
          id="actividad_economica"
          type="text"
          value={form.actividad_economica}
          onChange={(e) => onChange('actividad_economica', e.target.value)}
          className={inputClass}
          placeholder="Ej: Venta de comidas y bebidas"
          disabled={loading}
        />
      </div>

      {/* Sección de contacto */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Datos de contacto <span className={optionalClass}>(opcional)</span>
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              className={inputClass}
              placeholder="contacto@lomiteria.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="telefono" className={labelClass}>
              Teléfono
            </label>
            <input
              id="telefono"
              type="tel"
              value={form.telefono}
              onChange={(e) => onChange('telefono', e.target.value)}
              className={inputClass}
              placeholder="0981 123 456"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="direccion" className={labelClass}>
              Dirección
            </label>
            <input
              id="direccion"
              type="text"
              value={form.direccion}
              onChange={(e) => onChange('direccion', e.target.value)}
              className={inputClass}
              placeholder="Av. Eusebio Ayala 1234, Asunción"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="logo_url" className={labelClass}>
              URL del logo <span className={optionalClass}>(opcional)</span>
            </label>
            <input
              id="logo_url"
              type="url"
              value={form.logo_url}
              onChange={(e) => onChange('logo_url', e.target.value)}
              className={inputClass}
              placeholder="https://ejemplo.com/logo.png"
              disabled={loading}
            />
            {form.logo_url && (
              <div className="mt-2 flex items-center gap-3">
                <Image
                  src={form.logo_url}
                  alt="Preview del logo"
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-600"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">Vista previa</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creando lomitería...' : 'Siguiente →'}
      </button>
    </form>
  )
}
