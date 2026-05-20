// Tipos simples para la base de datos
// Versión simplificada sin tipos complejos

export interface Categoria {
  id: string
  tenant_id: string
  nombre: string
  descripcion?: string
  orden: number
  activa: boolean
}

export interface Producto {
  id: string
  tenant_id: string
  nombre: string
  descripcion?: string
  precio: number
  categoria_id?: string
  disponible: boolean
  imagen_url?: string
  tiene_receta: boolean
  /** Puntos bonus adicionales por unidad vendida (sobre la acumulación auto) */
  puntos_extra: number
  is_deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
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
  pedido_ciclo: number
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

export interface Ingrediente {
  id: string
  tenant_id: string
  slug: string
  nombre: string
  tipo_inventario: 'discreto' | 'fraccionable'
  unidad: string
  stock_actual: number
  stock_minimo: number
  icono?: string
  precio_publico?: number
  /** POS: estandar | proteina | omitir para sin banda */
  tipo_recargo_extra?: 'estandar' | 'proteina' | null
  controlar_stock: boolean
  permite_extra_en_carrito?: boolean
  descripcion?: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface RecetaProducto {
  id: string
  tenant_id: string
  producto_id: string
  ingrediente_id: string
  cantidad: number
  unidad: string
  obligatorio: boolean
  created_at: string
  updated_at: string
}

export interface MovimientoIngrediente {
  id: string
  tenant_id: string
  ingrediente_id: string
  pedido_id?: string
  tipo: 'entrada' | 'salida' | 'ajuste' | 'inicial'
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  motivo?: string
  usuario_id?: string
  created_at: string
}

export interface ItemPedidoCustomizacion {
  id: string
  tenant_id: string
  pedido_id: string
  item_pedido_id: string
  ingrediente_id: string
  tipo: 'extra' | 'removido' | 'modificado'
  cantidad_original: number
  cantidad_ajustada: number
  created_at: string
}

export interface ComboItem {
  id: string
  tenant_id: string
  combo_id: string
  producto_id: string
  cantidad: number
  created_at: string
  updated_at: string
}

export interface Inventario {
  id: string
  tenant_id: string
  producto_id: string | null
  nombre: string | null
  tipo_inventario: 'discreto' | 'fraccionable'
  stock_actual: number
  stock_minimo: number
  unidad: string
  controlar_stock: boolean
}
