export type EstadoPedidoFilter = 'todos' | 'FACT' | 'ANUL'

export interface HistorialPedidosFilters {
  fechaDesde: string
  fechaHasta: string
  estadoPedido: EstadoPedidoFilter
  numeroPedido: string
}

export interface PedidoParaHistorial {
  id: string
  numero_pedido: number
  pedido_ciclo: number
  tenant_id: string
  cliente_id: string | null
  usuario_id: string | null
  tipo: 'local' | 'delivery' | 'para_llevar'
  estado: string
  estado_pedido: string
  total: number
  puntos_generados: number
  created_at: string
  cancelado_por_id: string | null
  cancelado_at: string | null
  motivo_cancelacion: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  cliente_direccion: string | null
  usuario_nombre: string | null
  /** Notas generales del pedido (cocina / observaciones) */
  notas: string | null
  /** Texto corto tipo "3 líneas · Producto A ×2, B ×1" para identificar el pedido en listas */
  items_preview: string
  /** Hay factura no anulada → habilitar “Imprimir factura” */
  factura_imprimible: boolean
}
