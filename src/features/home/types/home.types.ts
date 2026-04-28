export interface DashboardCard {
  title: string
  description: string
  href: string
  icon: 'pos' | 'admin' | 'pedidos' | 'clientes' | 'cocina' | 'mesas'
  color: 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'amber'
}

export interface Feature {
  icon: string
  title: string
  description: string
}

export interface TenantInfo {
  nombre: string
  usuario?: string
}
