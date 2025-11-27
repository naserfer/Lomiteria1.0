// Tipos simples para la base de datos
// Versión simplificada sin tipos complejos

export interface Categoria {
  id: string
  nombre: string
  descripcion?: string
  orden: number
  activa: boolean
}

export interface Producto {
  id: string
  nombre: string
  descripcion?: string
  precio: number
  categoria_id?: string
  disponible: boolean
  imagen_url?: string
}

export interface Cliente {
  id: string
  telefono: string
  nombre: string
  email?: string
  puntos_totales: number
}

export interface Pedido {
  id: string
  numero_pedido: number
  cliente_id?: string
  tipo: 'delivery' | 'local' | 'takeaway'
  estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
  total: number
  puntos_generados: number
  notas?: string
  fecha_creacion: string
}

export interface ItemPedido {
  id: string
  pedido_id: string
  producto_id?: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}


