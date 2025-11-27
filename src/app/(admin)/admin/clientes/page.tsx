'use client'

import { useState, useEffect } from 'react'
import { useTenant } from '@/features/auth/TenantContext'
import { supabase } from '@/core/supabase'
import { getClientesPorTenant, crearCliente, buscarClientes, actualizarCliente } from '@/features/clientes/clientes.service'
import type { Cliente, NuevoCliente } from '@/shared/types/supabase'
import { UserPlus, Search, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

// Tipo local con campos opcionales para compatibilidad con consultas SQL
type ClienteLocal = Cliente & { tenant_id?: string; created_at?: string; ci?: string }

export default function ClientesPage() {
  const { tenant, loading: tenantLoading } = useTenant()
  const [clientes, setClientes] = useState<ClienteLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteLocal | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    ci: '',
    telefono: '',
    email: '',
    direccion: ''
  })

  const loadClientes = async () => {
    if (!tenant) return
    
    try {
      setLoading(true)
      const data = await getClientesPorTenant(tenant.id)
      setClientes((data || []) as ClienteLocal[])
    } catch (error) {
      console.error('Error cargando clientes:', error)
      alert('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  // Cargar clientes
  useEffect(() => {
    if (tenantLoading || !tenant) return
    
    loadClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, tenantLoading])

  // Buscar clientes
  const handleSearch = async () => {
    if (!tenant || !searchTerm.trim()) {
      loadClientes()
      return
    }

    try {
      setLoading(true)
      const resultados = await buscarClientes(searchTerm.trim(), tenant.id)
      setClientes((resultados || []) as ClienteLocal[])
    } catch (error) {
      console.error('Error buscando clientes:', error)
      alert('Error al buscar clientes')
    } finally {
      setLoading(false)
    }
  }

  // Abrir modal para nuevo cliente
  const handleNuevoCliente = () => {
    setEditingCliente(null)
    setFormData({
      nombre: '',
      ci: '',
      telefono: '',
      email: '',
      direccion: ''
    })
    setShowModal(true)
  }

  // Abrir modal para editar cliente
  const handleEditarCliente = (cliente: ClienteLocal) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre || '',
      ci: cliente.ci || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || ''
    })
    setShowModal(true)
  }

  // Guardar cliente
  const handleGuardar = async () => {
    if (!tenant) return

    // Validaciones
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    if (!formData.telefono.trim() && !formData.ci.trim()) {
      alert('Debe ingresar al menos teléfono o CI')
      return
    }

    try {
      setSaving(true)

      if (editingCliente) {
        // Actualizar cliente existente
        await actualizarCliente(editingCliente.id, {
          ...formData,
          nombre: formData.nombre.trim(),
          ci: formData.ci.trim() || null,
          telefono: formData.telefono.trim() || null,
          email: formData.email.trim() || null,
          direccion: formData.direccion.trim() || null,
        } as Partial<Cliente>)
        
        alert('✅ Cliente actualizado correctamente')
      } else {
        // Crear nuevo cliente
        await crearCliente({
          tenant_id: tenant.id,
          nombre: formData.nombre.trim(),
          ci: formData.ci.trim() || null,
          telefono: formData.telefono.trim() || null,
          email: formData.email.trim() || null,
          direccion: formData.direccion.trim() || null,
          puntos_totales: 0
        } as NuevoCliente)
        
        alert('✅ Cliente creado correctamente')
      }

      setShowModal(false)
      loadClientes()
    } catch (error: any) {
      console.error('Error guardando cliente:', error)
      alert(`Error: ${error.message || 'Error al guardar cliente'}`)
    } finally {
      setSaving(false)
    }
  }

  // Formatear fecha
  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-PY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/admin"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Volver al Panel de Administración
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                👥 Gestión de Clientes
              </h1>
              <p className="text-gray-600">
                Administra los clientes de {tenant?.nombre}
              </p>
            </div>
            <button
              onClick={handleNuevoCliente}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              <UserPlus size={20} />
              Nuevo Cliente
            </button>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nombre, CI o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
            >
              Buscar
            </button>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  loadClientes()
                }}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Lista de Clientes */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">CI</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Teléfono</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Puntos</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Registrado</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados. Crea el primero.'}
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{cliente.nombre}</td>
                      <td className="px-6 py-4 text-gray-600">{cliente.ci || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{cliente.telefono || '-'}</td>
                      <td className="px-6 py-4 text-gray-600">{cliente.email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                          ⭐ {cliente.puntos_totales}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {formatearFecha(cliente.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditarCliente(cliente)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <Link
                            href={`/admin/clientes/${cliente.id}/puntos`}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Ver puntos"
                          >
                            ⭐
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Contador */}
          {clientes.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Total: {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Modal de Crear/Editar Cliente */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingCliente ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Juan Pérez"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* CI */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Cédula de Identidad (CI)
                    </label>
                    <input
                      type="text"
                      value={formData.ci}
                      onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                      placeholder="1234567"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="(0981) 123-456"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email (opcional)
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="cliente@email.com"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Dirección (opcional)
                    </label>
                    <textarea
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Av. Principal 123"
                      rows={2}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Botones */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardar}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        {editingCliente ? 'Actualizar' : 'Crear'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

