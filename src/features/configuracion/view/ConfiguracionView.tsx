'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Save, Mail, Phone, MapPin, Building2, FileText, Upload, Loader2, LayoutGrid, Printer } from 'lucide-react'
import { useTenant } from '@/contexts/TenantContext'
import { updateMyTenant, uploadLogoMyTenant, toggleGestionMesas, toggleDelivery } from '@/app/actions/tenant'
import { getPrinterCopiasForTenant, updatePrinterCopiasForTenant } from '@/app/actions/printerCopiasSettings'

const inputClass =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-400 dark:focus:border-orange-400 focus:outline-none transition bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export function ConfiguracionView() {
  const { tenant, reloadTenant } = useTenant()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [togglingMesas, setTogglingMesas] = useState(false)
  const [mesasError, setMesasError] = useState('')
  const [togglingDelivery, setTogglingDelivery] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')

  const [dobleCocina, setDobleCocina] = useState(false)
  const [dobleFacturaCierre, setDobleFacturaCierre] = useState(false)
  const [hasPrinterRow, setHasPrinterRow] = useState(true)
  const [loadingCopias, setLoadingCopias] = useState(true)
  const [togglingCopias, setTogglingCopias] = useState(false)
  const [copiasError, setCopiasError] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    logo_url: '',
    direccion: '',
    telefono: '',
    email: '',
    ruc: '',
    razon_social: '',
    actividad_economica: '',
    saludo_final: '',
  })

  useEffect(() => {
    if (!tenant?.id) return
    let cancelled = false
    setLoadingCopias(true)
    setCopiasError('')
    getPrinterCopiasForTenant(tenant.id).then((r) => {
      if (cancelled) return
      setLoadingCopias(false)
      if (r.error || r.copias_ticket_cocina === null) {
        if (r.error) setCopiasError(r.error)
        return
      }
      setDobleCocina(r.copias_ticket_cocina === 2)
      setDobleFacturaCierre(r.copias_factura_cierre === 2)
      setHasPrinterRow(r.hasPrinterRow)
    })
    return () => {
      cancelled = true
    }
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant) return
    setForm({
      nombre: tenant.nombre ?? '',
      logo_url: tenant.logo_url ?? '',
      direccion: tenant.direccion ?? '',
      telefono: tenant.telefono ?? '',
      email: tenant.email ?? '',
      ruc: tenant.ruc ?? '',
      razon_social: tenant.razon_social ?? '',
      actividad_economica: tenant.actividad_economica ?? '',
      saludo_final: tenant.config_impresion?.pie_ticket ?? '¡Gracias por tu compra!',
    })
    setPreviewKey((k) => k + 1)
  }, [tenant])

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleToggleMesas = async (enabled: boolean) => {
    setTogglingMesas(true)
    setMesasError('')
    const result = await toggleGestionMesas(enabled)
    setTogglingMesas(false)
    if (result.error) {
      setMesasError(result.error)
      return
    }
    await reloadTenant()
  }

  const applyCopias = async (next: { cocina: boolean; factura: boolean }) => {
    if (!tenant?.id) return
    setTogglingCopias(true)
    setCopiasError('')
    const result = await updatePrinterCopiasForTenant(tenant.id, {
      copias_ticket_cocina: next.cocina ? 2 : 1,
      copias_factura_cierre: next.factura ? 2 : 1,
    })
    setTogglingCopias(false)
    if (result.error) {
      setCopiasError(result.error)
      return
    }
    setDobleCocina(next.cocina)
    setDobleFacturaCierre(next.factura)
    setHasPrinterRow(true)
  }

  const handleToggleDelivery = async (enabled: boolean) => {
    setTogglingDelivery(true)
    setDeliveryError('')
    const result = await toggleDelivery(enabled)
    setTogglingDelivery(false)
    if (result.error) {
      setDeliveryError(result.error)
      return
    }
    await reloadTenant()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingLogo(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadLogoMyTenant(formData)
    setUploadingLogo(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.url) {
      setField('logo_url', result.url)
      setPreviewKey((k) => k + 1)
      setSuccess('Foto subida. Guardá los cambios para aplicarla.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.nombre.trim()) {
      setError('El nombre del negocio es requerido')
      return
    }
    setSaving(true)
    const result = await updateMyTenant({
      nombre: form.nombre,
      logo_url: form.logo_url,
      direccion: form.direccion,
      telefono: form.telefono,
      email: form.email,
      ruc: form.ruc,
      razon_social: form.razon_social,
      actividad_economica: form.actividad_economica,
      saludo_final: form.saludo_final,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess('Configuración guardada correctamente')
    router.refresh()
  }

  if (!tenant) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center text-gray-500 dark:text-gray-400">
        Cargando datos del negocio…
      </div>
    )
  }

  const mesasActivo    = tenant?.gestion_mesas ?? false
  const deliveryActivo = tenant?.has_delivery  ?? false

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Configuración del negocio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Datos visibles, fiscales y contacto de tu local.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm">
              {success}
            </div>
          )}

          {/* Datos visibles del negocio */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Datos del negocio
            </h2>
            <div>
              <label htmlFor="config-nombre" className={labelClass}>
                Nombre del local
              </label>
              <input
                id="config-nombre"
                type="text"
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                className={inputClass}
                placeholder="Ej: Atlas Burger"
                disabled={saving}
              />
            </div>
            <div>
              <label className={labelClass}>
                Foto del local
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileSelect}
                  disabled={saving || uploadingLogo}
                  className="hidden"
                  id="config-logo-file"
                />
                <label
                  htmlFor="config-logo-file"
                  className={`
                    inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition cursor-pointer
                    ${saving || uploadingLogo
                      ? 'border-gray-300 dark:border-gray-600 text-gray-400 cursor-not-allowed'
                      : 'border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }
                  `}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">
                    {uploadingLogo ? 'Subiendo…' : 'Elegir imagen desde archivos'}
                  </span>
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG, WebP o GIF. Máx. 5 MB.
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {form.logo_url ? (
                  <>
                    <Image
                      key={`${form.logo_url}-${previewKey}`}
                      src={`${form.logo_url}${form.logo_url.includes('?') ? '&' : '?'}t=${previewKey}`}
                      alt="Vista previa del local"
                      width={80}
                      height={80}
                      unoptimized
                      className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800"
                      onError={(e) => {
                        const el = e.currentTarget
                        el.style.display = 'none'
                        const next = el.nextElementSibling
                        if (next instanceof HTMLElement) next.style.display = 'flex'
                      }}
                    />
                    <span
                      className="w-20 h-20 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400"
                      style={{ display: 'none' }}
                      aria-hidden
                    >
                      No se pudo cargar
                    </span>
                  </>
                ) : (
                  <span className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                    Sin imagen
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">Vista previa</span>
              </div>
            </div>
            <div>
              <label htmlFor="config-direccion" className={labelClass}>
                <MapPin className="w-4 h-4 inline mr-1" />
                Dirección
              </label>
              <input
                id="config-direccion"
                type="text"
                value={form.direccion}
                onChange={(e) => setField('direccion', e.target.value)}
                className={inputClass}
                placeholder="Av. Eusebio Ayala 1234"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="config-telefono" className={labelClass}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Teléfono
                </label>
                <input
                  id="config-telefono"
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setField('telefono', e.target.value)}
                  className={inputClass}
                  placeholder="021 123 456"
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="config-email" className={labelClass}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  id="config-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={inputClass}
                  placeholder="contacto@local.com"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Datos fiscales */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Datos fiscales
            </h2>
            <div>
              <label htmlFor="config-ruc" className={labelClass}>
                RUC
              </label>
              <input
                id="config-ruc"
                type="text"
                value={form.ruc}
                onChange={(e) => setField('ruc', e.target.value)}
                className={inputClass}
                placeholder="80012345-6"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="config-razon_social" className={labelClass}>
                Razón social (factura)
              </label>
              <input
                id="config-razon_social"
                type="text"
                value={form.razon_social}
                onChange={(e) => setField('razon_social', e.target.value)}
                className={inputClass}
                placeholder="Nombre legal del negocio"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="config-actividad_economica" className={labelClass}>
                Actividad económica
              </label>
              <input
                id="config-actividad_economica"
                type="text"
                value={form.actividad_economica}
                onChange={(e) => setField('actividad_economica', e.target.value)}
                className={inputClass}
                placeholder="Ej: Venta de comidas"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="config-saludo-final" className={labelClass}>
                Texto final ticket/factura
              </label>
              <textarea
                id="config-saludo-final"
                value={form.saludo_final}
                onChange={(e) => setField('saludo_final', e.target.value)}
                className={inputClass}
                placeholder="Ej: ¡Gracias por su preferencia!"
                rows={3}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Se usa como saludo final en impresión (configuración por local).
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar cambios
              </>
            )}
          </button>
        </form>
      </div>

      {/* Impresión (agente local) */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Impresión en el local
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            El agente de impresión en tu PC lee estos valores. Una copia por defecto; activá el doble solo si lo necesitás.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {copiasError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {copiasError}
            </div>
          )}
          {loadingCopias ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando preferencias de impresión…
            </div>
          ) : (
            <>
              {!hasPrinterRow && (
                <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  Todavía no hay impresora registrada para este local en el sistema. Cuando KarúBox deje configurada la
                  impresora del negocio, podrás activar el doble ticket acá.
                </p>
              )}
              <div
                className={`flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 ${
                  !hasPrinterRow || togglingCopias ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Doble ticket de cocina</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Al confirmar pedidos (pasan a FACT), imprimir dos tickets de cocina en lugar de uno.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dobleCocina}
                  disabled={!hasPrinterRow || togglingCopias}
                  onClick={() => applyCopias({ cocina: !dobleCocina, factura: dobleFacturaCierre })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                    dobleCocina ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      dobleCocina ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div
                className={`flex items-center justify-between gap-4 py-3 ${
                  !hasPrinterRow || togglingCopias ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Doble factura al cerrar cuenta</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Cada impresión de factura (por ejemplo al cerrar mesa) sale dos veces en papel. Independiente del ticket
                    de cocina.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={dobleFacturaCierre}
                  disabled={!hasPrinterRow || togglingCopias}
                  onClick={() => applyCopias({ cocina: dobleCocina, factura: !dobleFacturaCierre })}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed ${
                    dobleFacturaCierre ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      dobleFacturaCierre ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Módulos opcionales */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Módulos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Activá o desactivá funcionalidades según las necesidades de tu negocio.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {(mesasError || deliveryError) && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              {mesasError || deliveryError}
            </div>
          )}

          {/* Toggle: Gestión de Mesas */}
          <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Gestión de Mesas</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Habilitá el panel de mesas para gestionar ocupación, reservas y pedidos por mesa.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mesasActivo}
              disabled={togglingMesas}
              onClick={() => handleToggleMesas(!mesasActivo)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                mesasActivo ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  mesasActivo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle: Delivery */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Servicio de Delivery</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Muestra la opción &quot;Delivery&quot; al tomar pedidos en el POS. Desactivado = solo Comer aquí y Para llevar.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={deliveryActivo}
              disabled={togglingDelivery}
              onClick={() => handleToggleDelivery(!deliveryActivo)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                deliveryActivo ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  deliveryActivo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
