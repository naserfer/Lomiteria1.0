// Tipos generados para Supabase
// Estos tipos corresponden al esquema de la base de datos
// TEMPORALMENTE SIMPLIFICADO PARA EVITAR ERRORES DE COMPILACIÓN

export type Json = any

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          orden: number
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          orden?: number
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          orden?: number
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      productos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          precio: number
          categoria_id: string | null
          disponible: boolean
          imagen_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          precio: number
          categoria_id?: string | null
          disponible?: boolean
          imagen_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          precio?: number
          categoria_id?: string | null
          disponible?: boolean
          imagen_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      clientes: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          telefono: string | null
          email: string | null
          direccion: string | null
          puntos_totales: number
          notas: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
          deleted_at: string | null
          ci: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          puntos_totales?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
          deleted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          puntos_totales?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
          deleted_at?: string | null
        }
      }
      pedidos: {
        Row: {
          id: string
          numero_pedido: number
          cliente_id: string | null
          tipo: 'delivery' | 'local' | 'takeaway'
          estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
          total: number
          puntos_generados: number
          notas: string | null
          direccion_entrega: string | null
          fecha_creacion: string
          fecha_actualizado: string
          fecha_entregado: string | null
        }
        Insert: {
          id?: string
          numero_pedido?: number
          cliente_id?: string | null
          tipo: 'delivery' | 'local' | 'takeaway'
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
          total: number
          puntos_generados?: number
          notas?: string | null
          direccion_entrega?: string | null
          fecha_creacion?: string
          fecha_actualizado?: string
          fecha_entregado?: string | null
        }
        Update: {
          id?: string
          numero_pedido?: number
          cliente_id?: string | null
          tipo?: 'delivery' | 'local' | 'takeaway'
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
          total?: number
          puntos_generados?: number
          notas?: string | null
          direccion_entrega?: string | null
          fecha_creacion?: string
          fecha_actualizado?: string
          fecha_entregado?: string | null
        }
      }
      items_pedido: {
        Row: {
          id: string
          pedido_id: string | null
          producto_id: string | null
          producto_nombre: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          personalizaciones: Json
          created_at: string
        }
        Insert: {
          id?: string
          pedido_id?: string | null
          producto_id?: string | null
          producto_nombre: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          personalizaciones?: Json
          created_at?: string
        }
        Update: {
          id?: string
          pedido_id?: string | null
          producto_id?: string | null
          producto_nombre?: string
          cantidad?: number
          precio_unitario?: number
          subtotal?: number
          personalizaciones?: Json
          created_at?: string
        }
      }
      transacciones_puntos: {
        Row: {
          id: string
          cliente_id: string | null
          pedido_id: string | null
          tipo: 'ganado' | 'canjeado' | 'ajuste' | 'expiracion'
          puntos: number
          saldo_anterior: number
          saldo_nuevo: number
          descripcion: string | null
          fecha: string
          usuario_responsable: string | null
        }
        Insert: {
          id?: string
          cliente_id?: string | null
          pedido_id?: string | null
          tipo: 'ganado' | 'canjeado' | 'ajuste' | 'expiracion'
          puntos: number
          saldo_anterior: number
          saldo_nuevo: number
          descripcion?: string | null
          fecha?: string
          usuario_responsable?: string | null
        }
        Update: {
          id?: string
          cliente_id?: string | null
          pedido_id?: string | null
          tipo?: 'ganado' | 'canjeado' | 'ajuste' | 'expiracion'
          puntos?: number
          saldo_anterior?: number
          saldo_nuevo?: number
          descripcion?: string | null
          fecha?: string
          usuario_responsable?: string | null
        }
      }
      promociones: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          tipo: 'puntos' | 'descuento' | 'regalo'
          multiplicador: number
          descuento_porcentaje: number | null
          dias_semana: number[]
          fecha_inicio: string | null
          fecha_fin: string | null
          activa: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          tipo: 'puntos' | 'descuento' | 'regalo'
          multiplicador?: number
          descuento_porcentaje?: number | null
          dias_semana?: number[]
          fecha_inicio?: string | null
          fecha_fin?: string | null
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          tipo?: 'puntos' | 'descuento' | 'regalo'
          multiplicador?: number
          descuento_porcentaje?: number | null
          dias_semana?: number[]
          fecha_inicio?: string | null
          fecha_fin?: string | null
          activa?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      vista_productos_completos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          precio: number
          disponible: boolean
          imagen_url: string | null
          categoria_nombre: string | null
          categoria_id: string | null
          categoria_orden: number | null
        }
      }
      vista_pedidos_completos: {
        Row: {
          id: string
          numero_pedido: number
          tipo: 'delivery' | 'local' | 'takeaway'
          estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'cancelado'
          total: number
          puntos_generados: number
          notas: string | null
          fecha_creacion: string
          cliente_nombre: string | null
          cliente_telefono: string | null
          cliente_id: string | null
          cantidad_items: number
        }
      }
      vista_top_clientes: {
        Row: {
          id: string
          nombre: string
          telefono: string
          puntos_totales: number
          total_pedidos: number
          total_gastado: number
          ultima_compra: string | null
        }
      }
    }
    Functions: {
      calcular_puntos: {
        Args: { monto: number; dia_semana: number }
        Returns: { puntos: number }
      }
    }
  }
}

// Tipos auxiliares
export type Categoria = Database['public']['Tables']['categorias']['Row']
export type Producto = Database['public']['Tables']['productos']['Row']
export type Cliente = Database['public']['Tables']['clientes']['Row']
export type Pedido = Database['public']['Tables']['pedidos']['Row']
export type ItemPedido = Database['public']['Tables']['items_pedido']['Row']
export type TransaccionPuntos = Database['public']['Tables']['transacciones_puntos']['Row']
export type Promocion = Database['public']['Tables']['promociones']['Row']

export type ProductoCompleto = Database['public']['Views']['vista_productos_completos']['Row']
export type PedidoCompleto = Database['public']['Views']['vista_pedidos_completos']['Row']
export type TopCliente = Database['public']['Views']['vista_top_clientes']['Row']

// Tipos para inserts
export type NuevoProducto = Database['public']['Tables']['productos']['Insert']
export type NuevoCliente = Database['public']['Tables']['clientes']['Insert']
export type NuevoPedido = Database['public']['Tables']['pedidos']['Insert']
export type NuevoItemPedido = Database['public']['Tables']['items_pedido']['Insert']

