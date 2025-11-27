'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/core/supabase'
import { User } from '@supabase/supabase-js'

export interface Tenant {
  id: string
  nombre: string
  slug: string
  logo_url?: string
  direccion?: string
  telefono?: string
  email?: string
  config_impresion?: any
}

export interface Usuario {
  id: string
  tenant_id: string
  nombre: string
  email: string
  rol: 'admin' | 'cajero' | 'cocinero' | 'repartidor'
  activo: boolean
}

interface TenantContextType {
  user: User | null
  usuario: Usuario | null
  tenant: Tenant | null
  loading: boolean
  darkMode: boolean
  toggleDarkMode: () => void
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isAdmin: boolean
  isCajero: boolean
  isCocinero: boolean
  isRepartidor: boolean
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  // Cargar dark mode de localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true'
    setDarkMode(savedMode)
  }, [])

  // Guardar dark mode en localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString())
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  useEffect(() => {
    // Verificar sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setUsuario(null)
        setTenant(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (authUserId: string) => {
    try {
      console.log('🔍 Buscando usuario con auth_user_id:', authUserId)
      
      // Obtener datos del usuario y su tenant
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select(`
          *,
          tenants!inner (*)
        `)
        .eq('auth_user_id', authUserId)
        .eq('is_deleted', false)
        .eq('tenants.is_deleted', false)
        .single()

      if (userError) {
        console.error('❌ Error en query de usuarios:', userError)
        console.error('❌ Detalles del error:', JSON.stringify(userError, null, 2))
        throw userError
      }

      if (!userData) {
        console.error('❌ No se encontró usuario vinculado con auth_user_id:', authUserId)
        alert(
          '⚠️ Usuario no vinculado\n\n' +
          `Tu usuario de Auth (${authUserId}) no está vinculado a ningún tenant.\n\n` +
          'Ejecuta en SQL Editor:\n\n' +
          `INSERT INTO usuarios (tenant_id, auth_user_id, email, nombre, rol)\n` +
          `VALUES (\n` +
          `  (SELECT id FROM tenants WHERE slug = 'lomiteria-don-juan'),\n` +
          `  '${authUserId}',\n` +
          `  'tu-email@ejemplo.com',\n` +
          `  'Tu Nombre',\n` +
          `  'admin'\n` +
          `);`
        )
        throw new Error('Usuario no vinculado')
      }

      console.log('✅ Usuario encontrado:', userData)

      setUsuario({
        id: userData.id,
        tenant_id: userData.tenant_id,
        nombre: userData.nombre,
        email: userData.email,
        rol: userData.rol,
        activo: userData.activo,
      })

      setTenant(userData.tenants as Tenant)
      console.log('✅ Tenant cargado:', userData.tenants)
    } catch (error) {
      console.error('❌ Error cargando datos del usuario:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error: error.message }
      }

      // loadUserData se llamará automáticamente por onAuthStateChange
      return {}
    } catch (error: any) {
      return { error: error.message }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const value: TenantContextType = {
    user,
    usuario,
    tenant,
    loading,
    darkMode,
    toggleDarkMode,
    signIn,
    signOut,
    isAdmin: usuario?.rol === 'admin',
    isCajero: usuario?.rol === 'cajero',
    isCocinero: usuario?.rol === 'cocinero',
    isRepartidor: usuario?.rol === 'repartidor',
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant debe usarse dentro de TenantProvider')
  }
  return context
}


