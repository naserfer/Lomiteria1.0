'use client'

import { useState, useEffect } from 'react'
import { upsertPrinterConfig, type CreatePrinterConfigData } from '@/app/actions/owner'
import type { PrinterConfig } from '@/types/supabase'

interface PrinterConfigFormProps {
  tenantId: string
  tenantSlug: string
  initialConfig?: PrinterConfig | null
  onSaved: () => void
  onCancel: () => void
}

const inputClass =
  'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 focus:outline-none transition bg-white dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const optionalClass = 'text-gray-400 dark:text-gray-500 font-normal'

export function PrinterConfigForm({ tenantId, tenantSlug, initialConfig, onSaved, onCancel }: PrinterConfigFormProps) {
  const [form, setForm] = useState<CreatePrinterConfigData>({
    printer_id: initialConfig?.printer_id || `${tenantSlug}-printer-1`,
    agent_ip: initialConfig?.agent_ip || 'localhost',
    agent_port: initialConfig?.agent_port || 3001,
    tipo_impresora: initialConfig?.tipo_impresora || 'usb',
    nombre_impresora: initialConfig?.nombre_impresora || 'Impresora Térmica Cocina',
    ubicacion: initialConfig?.ubicacion || 'Cocina',
    activo: initialConfig?.activo ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!initialConfig && tenantSlug) {
      setForm((prev) => ({ ...prev, printer_id: `${tenantSlug}-printer-1` }))
    }
  }, [tenantSlug, initialConfig])

  const handleChange = <K extends keyof CreatePrinterConfigData>(
    field: K,
    value: CreatePrinterConfigData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.printer_id.trim()) {
      setError('El ID de impresora es requerido')
      return
    }
    if (!form.agent_ip.trim()) {
      setError('La IP del agente es requerida')
      return
    }
    if (!form.agent_port || form.agent_port <= 0 || form.agent_port > 65535) {
      setError('El puerto debe estar entre 1 y 65535')
      return
    }

    setLoading(true)
    const result = await upsertPrinterConfig(tenantId, form)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="printer_id" className={labelClass}>
          ID de la impresora
        </label>
        <input
          id="printer_id"
          type="text"
          value={form.printer_id}
          onChange={(e) => handleChange('printer_id', e.target.value)}
          required
          className={inputClass}
          placeholder={`${tenantSlug}-printer-1`}
          disabled={loading}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Este ID debe coincidir con la configuración del agente de impresión para que funcione correctamente.
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Configuración del agente
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="agent_ip" className={labelClass}>
              IP del agente
            </label>
            <input
              id="agent_ip"
              type="text"
              value={form.agent_ip}
              onChange={(e) => handleChange('agent_ip', e.target.value)}
              required
              className={inputClass}
              placeholder="localhost o 192.168.1.100"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Usar <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">localhost</code> para red local o la IP del agente.
            </p>
          </div>

          <div>
            <label htmlFor="agent_port" className={labelClass}>
              Puerto del agente
            </label>
            <input
              id="agent_port"
              type="number"
              value={form.agent_port}
              onChange={(e) => handleChange('agent_port', parseInt(e.target.value, 10))}
              required
              min={1}
              max={65535}
              className={inputClass}
              placeholder="3001"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Normalmente 3001 para HTTP local. Usar 443 para HTTPS con túnel público.
            </p>
          </div>

          <div>
            <label htmlFor="tipo_impresora" className={labelClass}>
              Tipo de conexión
            </label>
            <select
              id="tipo_impresora"
              value={form.tipo_impresora}
              onChange={(e) => handleChange('tipo_impresora', e.target.value as 'usb' | 'network' | 'bluetooth')}
              className={inputClass}
              disabled={loading}
            >
              <option value="usb">USB</option>
              <option value="network">Red (Network)</option>
              <option value="bluetooth">Bluetooth</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Información adicional <span className={optionalClass}>(opcional)</span>
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="nombre_impresora" className={labelClass}>
              Nombre descriptivo
            </label>
            <input
              id="nombre_impresora"
              type="text"
              value={form.nombre_impresora || ''}
              onChange={(e) => handleChange('nombre_impresora', e.target.value)}
              className={inputClass}
              placeholder="Impresora Térmica Cocina"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="ubicacion" className={labelClass}>
              Ubicación física
            </label>
            <input
              id="ubicacion"
              type="text"
              value={form.ubicacion || ''}
              onChange={(e) => handleChange('ubicacion', e.target.value)}
              className={inputClass}
              placeholder="Cocina, Caja, etc."
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="activo"
              type="checkbox"
              checked={form.activo}
              onChange={(e) => handleChange('activo', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-2 transition"
              disabled={loading}
            />
            <label htmlFor="activo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Impresora activa
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  )
}
