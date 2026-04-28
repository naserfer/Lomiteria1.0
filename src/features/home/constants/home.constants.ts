import { ROUTES } from '@/config'
import type { DashboardCard } from '../types/home.types'

export interface Feature {
  icon: string
  title: string
  description: string
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  {
    title: 'Punto de Venta',
    description: 'Toma pedidos rápido, controla clientes y suma puntos automáticamente.',
    href: ROUTES.PROTECTED.POS,
    icon: 'pos',
    color: 'orange'
  },
  {
    title: 'Mesas',
    description: 'Gestioná ocupación del salón, reservas y pedidos por mesa.',
    href: ROUTES.PROTECTED.MESAS,
    icon: 'mesas',
    color: 'amber'
  },
  {
    title: 'Historial de pedidos',
    description: 'Consultá pedidos por fecha y estado. Solo administradores pueden anular.',
    href: `${ROUTES.PROTECTED.PEDIDOS}?from=${ROUTES.PEDIDOS_FROM.HOME}`,
    icon: 'pedidos',
    color: 'green'
  },
  {
    title: 'Administración',
    description: 'Panel con ventas, inventario, fidelización y cierres de caja.',
    href: ROUTES.PROTECTED.ADMIN,
    icon: 'admin',
    color: 'blue'
  },
  {
    title: 'Clientes',
    description: 'Gestioná clientes, puntos, campañas de fidelización y mensajes.',
    href: `${ROUTES.PROTECTED.CLIENTES}?from=${ROUTES.CLIENTES_FROM.HOME}`,
    icon: 'clientes',
    color: 'purple'
  },
  {
    title: 'Cocina 3D',
    description: 'Visualizá el flujo de pedidos en tu cocina 3D en tiempo real.',
    href: `${ROUTES.PROTECTED.COCINA}?from=${ROUTES.COCINA_FROM.HOME}`,
    icon: 'cocina',
    color: 'red'
  }
]

export const FEATURES: Feature[] = [
  {
    icon: '⚡',
    title: 'Rápido y Eficiente',
    description: 'Tomá pedidos en segundos.'
  },
  {
    icon: '⭐',
    title: 'Puntos de Fidelidad',
    description: 'Premiá a tus clientes frecuentes.'
  },
  {
    icon: '📊',
    title: 'Reportes Detallados',
    description: 'Analizá ventas en tiempo real.'
  }
]
