export type EstadoMesa = 'libre' | 'ocupada' | 'reservada' | 'bloqueada'

export interface Mesa {
  id: string
  tenant_id: string
  numero: number
  nombre: string | null
  capacidad: number
  estado: EstadoMesa
  activa: boolean
  orden: number
  created_at: string
  updated_at: string
}

export interface MesaReserva {
  id: string
  tenant_id: string
  mesa_id: string
  cliente_id: string | null
  nombre_reserva: string
  telefono: string | null
  cantidad_personas: number | null
  inicio_at: string
  fin_at: string | null
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada' | 'no_show'
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MesaUnion {
  id: string
  tenant_id: string
  codigo: string | null
  estado: 'activa' | 'cerrada'
  created_by: string | null
  created_at: string
  closed_at: string | null
}

export interface MesaUnionItem {
  id: string
  tenant_id: string
  union_id: string
  mesa_id: string
  created_at: string
}

export interface PedidoDivision {
  id: string
  tenant_id: string
  pedido_padre_id: string
  pedido_hijo_id: string
  monto: number
  created_by: string | null
  created_at: string
}

export interface ItemResumenMesa {
  id: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  notas: string | null
}

export interface PedidoResumenMesa {
  id: string
  numero_pedido: number
  estado_pedido: 'EDIT' | 'FACT'
  total: number
  created_at: string
  items: ItemResumenMesa[]
}

export interface ResumenMesa {
  mesa_id: string
  pedidos: PedidoResumenMesa[]
  total_items: number
  total_acumulado: number
}
