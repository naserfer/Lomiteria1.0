'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isMarketingLightDomPath } from '@/config/routes'
import { getLogoutRoute } from '@/config'
import { signOut as signOutAction } from '@/app/actions/auth'
import { User } from '@supabase/supabase-js'
import { prefetchPOSCatalog } from '@/features/pos/lib/catalogCache'

export interface Tenant {
  id: string
  nombre: string
  slug: string
  logo_url?: string
  direccion?: string
  telefono?: string
  email?: string
  config_impresion?: any
  activo: boolean
  /** RUC del local (emisor) */
  ruc?: string
  /** Razón social para factura (si no se define, se usa nombre) */
  razon_social?: string
  /** Actividad económica del negocio */
  actividad_economica?: string
  /** POS extras tier estándar: piso (Gs) */
  extra_precio_min_estandar?: number | string | null
  /** POS extras tier estándar: techo (Gs) */
  extra_precio_max_estandar?: number | string | null
  /** POS extras tier proteína: piso mínimo (Gs) */
  extra_precio_min_proteina?: number | string | null
  /** Retorno en puntos sobre ventas: 1, 5 o 10 (% del total). */
  puntos_retorno_pct?: number
  /** Módulo de gestión de mesas habilitado para este tenant. */
  gestion_mesas?: boolean
  /** Módulo de delivery habilitado para este tenant. */
  has_delivery?: boolean
}

interface Usuario {
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
  signOut: () => Promise<void>
  isAdmin: boolean
  isCajero: boolean
  isCocinero: boolean
  isRepartidor: boolean
  isTenantActive: boolean
  /** El tenant tiene habilitado el módulo de gestión de mesas. */
  hasMesas: boolean
  /** El tenant tiene habilitado el módulo de delivery. */
  hasDelivery: boolean
  /** Vuelve a cargar usuario + tenant desde Supabase (p. ej. tras cambiar configuración). */
  reloadTenant: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
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

  // Guardar dark mode en localStorage y aplicar clase al documento
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString())
    if (isMarketingLightDomPath(pathname)) {
      document.documentElement.classList.remove('dark')
      return
    }
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode, pathname])

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  const loadUserData = useCallback(async (authUserId: string) => {
    try {
      setLoading(true)
      const supabase = createClient()
      console.log('🔍 Cargando datos del usuario:', authUserId)
      
      // Obtener datos del usuario y su tenant
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select(`
          id,
          tenant_id,
          nombre,
          email,
          rol,
          activo,
          tenants!inner (
            id,
            nombre,
            slug,
            logo_url,
            direccion,
            telefono,
            email,
            config_impresion,
            activo,
            ruc,
            razon_social,
            actividad_economica,
            extra_precio_min_estandar,
            extra_precio_max_estandar,
            extra_precio_min_proteina,
            puntos_retorno_pct,
            gestion_mesas,
            has_delivery
          )
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

      const tenantRow = Array.isArray(userData.tenants)
        ? userData.tenants[0]
        : userData.tenants
      if (!tenantRow) {
        throw new Error('Tenant no encontrado para el usuario')
      }
      setTenant(tenantRow as Tenant)
      console.log('✅ Tenant cargado:', tenantRow)
      // Única carga del catálogo POS (categorías + productos) por sesión; el POS solo lee de cache
      prefetchPOSCatalog((tenantRow as Tenant).id)
    } catch (error) {
      console.error('❌ Error cargando datos del usuario:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const reloadTenant = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (uid) {
      await loadUserData(uid)
    }
  }, [loadUserData])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

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
  }, [loadUserData])

  const signOut = async () => {
    await signOutAction()
    // Recarga completa para sincronizar cookies de sesión (Supabase SSR)
    window.location.href = getLogoutRoute()
  }

  const value: TenantContextType = {
    user,
    usuario,
    tenant,
    loading,
    darkMode,
    toggleDarkMode,
    signOut,
    isAdmin: usuario?.rol === 'admin',
    isCajero: usuario?.rol === 'cajero',
    isCocinero: usuario?.rol === 'cocinero',
    isRepartidor: usuario?.rol === 'repartidor',
    isTenantActive: tenant?.activo ?? true,
    hasMesas: tenant?.gestion_mesas ?? false,
    hasDelivery: tenant?.has_delivery ?? false,
    reloadTenant,
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
