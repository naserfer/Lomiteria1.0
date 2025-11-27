'use client'

import { useState } from 'react'
import { X, Search, UserPlus } from 'lucide-react'
import { supabase } from '@/core/supabase'
import { useCartStore } from '@/features/pedidos/cartStore'
import { useTenant } from '@/features/auth/TenantContext'
import type { Cliente } from '@/shared/types/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function ClientModal({ isOpen, onClose }: Props) {
  const { tenant } = useTenant()
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [ci, setCi] = useState('')
  const [searching, setSearching] = useState(false)
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null)
  const [modoCrear, setModoCrear] = useState(false)
  const { setCliente } = useCartStore()

  if (!isOpen) return null

  const buscarCliente = async () => {
    if ((!telefono.trim() && !ci.trim()) || !tenant) return
    
    setSearching(true)
    try {
      let query = supabase
        .from('clientes')
        .select('*')
        .eq('tenant_id', tenant.id)

      // Buscar por teléfono o CI
      if (telefono.trim()) {
        query = query.eq('telefono', telefono.trim())
      } else if (ci.trim()) {
        query = query.eq('ci', ci.trim())
      }

      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No se encontró el cliente
          setClienteEncontrado(null)
          setModoCrear(true)
        } else {
          throw error
        }
      } else {
        setClienteEncontrado(data as Cliente)
        setNombre(data.nombre)
        setCi(data.ci || '')
        setModoCrear(false)
      }
    } catch (error) {
      console.error('Error buscando cliente:', error)
      alert('Error al buscar cliente')
    } finally {
      setSearching(false)
    }
  }

  const crearCliente = async () => {
    if ((!telefono.trim() && !ci.trim()) || !nombre.trim()) {
      alert('Por favor completa nombre y al menos teléfono o CI')
      return
    }

    if (!tenant) {
      alert('Error: No se pudo obtener información del tenant')
      return
    }

    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          tenant_id: tenant.id,
          telefono: telefono.trim() || null,
          ci: ci.trim() || null,
          nombre: nombre.trim(),
          puntos_totales: 0
        })
        .select()
        .single()

      if (error) throw error

      setCliente(data as Cliente)
      handleClose()
    } catch (error: any) {
      console.error('Error creando cliente:', error)
      alert(`Error al crear cliente: ${error.message || 'Error desconocido'}`)
    } finally {
      setSearching(false)
    }
  }

  const seleccionarCliente = () => {
    if (clienteEncontrado) {
      setCliente(clienteEncontrado)
      handleClose()
    }
  }

  const handleClose = () => {
    setTelefono('')
    setNombre('')
    setCi('')
    setClienteEncontrado(null)
    setModoCrear(false)
    onClose()
  }

  const continuarSinCliente = () => {
    setCliente(null)
    handleClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">👤</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Buscar o Crear Cliente</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all"
          >
            <X size={22} className="text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Si no hay cliente encontrado, mostrar formulario completo */}
          {!clienteEncontrado && (
            <>
              {/* Nombre - Siempre visible */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-base"
                  disabled={searching}
                />
              </div>

              {/* Teléfono y CI */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (telefono.trim() || ci.trim()) && buscarCliente()}
                    placeholder="(0981) 123-456"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-base"
                    disabled={searching}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    CI (Cédula)
                  </label>
                  <input
                    type="text"
                    value={ci}
                    onChange={(e) => setCi(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (telefono.trim() || ci.trim()) && buscarCliente()}
                    placeholder="1234567"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-base"
                    disabled={searching}
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={buscarCliente}
                  disabled={searching || !nombre.trim() || (!telefono.trim() && !ci.trim())}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <Search size={18} />
                  {searching ? 'Buscando...' : 'Buscar Cliente'}
                </button>
                {!modoCrear && (
                  <button
                    onClick={() => {
                      if (!nombre.trim()) {
                        alert('Por favor ingresa el nombre del cliente')
                        return
                      }
                      if (!telefono.trim() && !ci.trim()) {
                        alert('Por favor ingresa teléfono o CI')
                        return
                      }
                      crearCliente()
                    }}
                    disabled={searching || !nombre.trim() || (!telefono.trim() && !ci.trim())}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} />
                    {searching ? 'Creando...' : 'Crear Nuevo'}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Resultado: Cliente encontrado */}
          {clienteEncontrado && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">✓</span>
                </div>
                <h3 className="font-bold text-lg text-green-900">Cliente Encontrado</h3>
              </div>
              
              <div className="bg-white rounded-lg p-4 space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium min-w-[80px]">Nombre:</span>
                  <span className="text-gray-900 font-semibold">{clienteEncontrado.nombre}</span>
                </div>
                {clienteEncontrado.ci && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium min-w-[80px]">CI:</span>
                    <span className="text-gray-900">{clienteEncontrado.ci}</span>
                  </div>
                )}
                {clienteEncontrado.telefono && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-medium min-w-[80px]">Teléfono:</span>
                    <span className="text-gray-900">{clienteEncontrado.telefono}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <span className="text-blue-600 font-semibold text-lg">
                    ⭐ {clienteEncontrado.puntos_totales} puntos
                  </span>
                </div>
              </div>

              <button
                onClick={seleccionarCliente}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                ✓ Seleccionar este Cliente
              </button>
            </div>
          )}

          {/* Modo crear: cuando se busca y no se encuentra */}
          {modoCrear && clienteEncontrado === null && (
            <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus size={20} className="text-blue-600" />
                <span className="font-semibold text-blue-900">Cliente no encontrado</span>
              </div>
              <p className="text-sm text-blue-800 mb-4">
                No se encontró un cliente con esos datos. Puedes crear uno nuevo completando los campos arriba.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">O</span>
            </div>
          </div>

          {/* Continuar sin cliente */}
          <button
            onClick={continuarSinCliente}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all border-2 border-gray-300 hover:border-gray-400"
          >
            Continuar sin cliente
          </button>
        </div>
      </div>
    </div>
  )
}



