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
          mostrar_en_pos: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          orden?: number
          activa?: boolean
          mostrar_en_pos?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          orden?: number
          activa?: boolean
          mostrar_en_pos?: boolean
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
          tasa_iva: number
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
          tasa_iva?: number
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
          tasa_iva?: number
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
          ruc: string | null
          pasaporte: string | null
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
          ci?: string | null
          ruc?: string | null
          pasaporte?: string | null
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
          ci?: string | null
          ruc?: string | null
          pasaporte?: string | null
        }
      }
      pedidos: {
        Row: {
          id: string
          tenant_id: string
          numero_pedido: number
          cliente_id: string | null
          usuario_id: string | null
          tipo: 'local' | 'delivery' | 'para_llevar'
          estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total: number
          puntos_generados: number
          notas: string | null
          created_at: string
          updated_at: string
          cancelado_por_id: string | null
          cancelado_at: string | null
          motivo_cancelacion: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          numero_pedido?: number
          cliente_id?: string | null
          usuario_id?: string | null
          tipo: 'local' | 'delivery' | 'para_llevar'
          estado?: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total: number
          puntos_generados?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          cancelado_por_id?: string | null
          cancelado_at?: string | null
          motivo_cancelacion?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          numero_pedido?: number
          cliente_id?: string | null
          usuario_id?: string | null
          tipo?: 'local' | 'delivery' | 'para_llevar'
          estado?: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
          total?: number
          puntos_generados?: number
          notas?: string | null
          created_at?: string
          updated_at?: string
          cancelado_por_id?: string | null
          cancelado_at?: string | null
          motivo_cancelacion?: string | null
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
          iva_porcentaje: number
          monto_iva: number
          notas: string | null
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
          iva_porcentaje?: number
          monto_iva?: number
          notas?: string | null
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
          iva_porcentaje?: number
          monto_iva?: number
          notas?: string | null
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
      printer_config: {
        Row: {
          id: string
          lomiteria_id: string
          printer_id: string
          agent_ip: string
          agent_port: number
          tipo_impresora: 'usb' | 'network' | 'bluetooth' | null
          nombre_impresora: string | null
          ubicacion: string | null
          activo: boolean
          copias_ticket_cocina: number
          copias_factura_cierre: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lomiteria_id: string
          printer_id: string
          agent_ip: string
          agent_port?: number
          tipo_impresora?: 'usb' | 'network' | 'bluetooth' | null
          nombre_impresora?: string | null
          ubicacion?: string | null
          activo?: boolean
          copias_ticket_cocina?: number
          copias_factura_cierre?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lomiteria_id?: string
          printer_id?: string
          agent_ip?: string
          agent_port?: number
          tipo_impresora?: 'usb' | 'network' | 'bluetooth' | null
          nombre_impresora?: string | null
          ubicacion?: string | null
          activo?: boolean
          copias_ticket_cocina?: number
          copias_factura_cierre?: number
          created_at?: string
          updated_at?: string
        }
      }
      tenant_facturacion: {
        Row: {
          tenant_id: string
          timbrado: string
          vigencia_inicio: string
          vigencia_fin: string
          establecimiento: string
          punto_expedicion: string
          ultimo_numero: number
          created_at: string
          updated_at: string
        }
        Insert: {
          tenant_id: string
          timbrado: string
          vigencia_inicio: string
          vigencia_fin: string
          establecimiento?: string
          punto_expedicion?: string
          ultimo_numero?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          tenant_id?: string
          timbrado?: string
          vigencia_inicio?: string
          vigencia_fin?: string
          establecimiento?: string
          punto_expedicion?: string
          ultimo_numero?: number
          created_at?: string
          updated_at?: string
        }
      }
      facturas: {
        Row: {
          id: string
          tenant_id: string
          pedido_id: string
          numero_factura: string
          timbrado: string
          fecha_emision: string
          cliente_id: string | null
          total: number
          total_iva_10: number
          total_iva_5: number
          total_exento: number
          total_letras: string | null
          created_at: string
          updated_at: string
          anulada: boolean
          anulada_at: string | null
          anulada_por_id: string | null
          receptor_nombre_impresion: string | null
          receptor_ruc_impresion: string | null
          receptor_ci_impresion: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          pedido_id: string
          numero_factura: string
          timbrado: string
          fecha_emision?: string
          cliente_id?: string | null
          total: number
          total_iva_10?: number
          total_iva_5?: number
          total_exento?: number
          total_letras?: string | null
          created_at?: string
          updated_at?: string
          anulada?: boolean
          anulada_at?: string | null
          anulada_por_id?: string | null
          receptor_nombre_impresion?: string | null
          receptor_ruc_impresion?: string | null
          receptor_ci_impresion?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          pedido_id?: string
          numero_factura?: string
          timbrado?: string
          fecha_emision?: string
          cliente_id?: string | null
          total?: number
          total_iva_10?: number
          total_iva_5?: number
          total_exento?: number
          total_letras?: string | null
          created_at?: string
          updated_at?: string
          anulada?: boolean
          anulada_at?: string | null
          anulada_por_id?: string | null
          receptor_nombre_impresion?: string | null
          receptor_ruc_impresion?: string | null
          receptor_ci_impresion?: string | null
        }
      }
      reprint_solicitud: {
        Row: {
          id: string
          tenant_id: string
          pedido_id: string
          tipo: 'cocina' | 'factura'
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          pedido_id: string
          tipo: 'cocina' | 'factura'
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          pedido_id?: string
          tipo?: 'cocina' | 'factura'
          created_at?: string
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
      vista_items_ticket_cocina: {
        Row: {
          pedido_id: string
          item_pedido_id: string
          producto_nombre: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          notas_item: string | null
          modificaciones: string | null
        }
      },
      vista_factura_impresion: {
        Row: {
          factura_id: string
          pedido_id: string
          tenant_id: string
          numero_pedido: number
          emisor_ruc: string | null
          emisor_razon_social: string | null
          emisor_direccion: string | null
          emisor_telefono: string | null
          emisor_email: string | null
          emisor_actividad_economica: string | null
          receptor_ruc: string | null
          receptor_ci: string | null
          receptor_nombre: string | null
          receptor_direccion: string | null
          receptor_telefono: string | null
          receptor_email: string | null
          numero_factura: string
          timbrado: string
          timbrado_vigencia_inicio: string
          timbrado_vigencia_fin: string
          fecha_emision: string
          total_iva_10: number
          total_iva_5: number
          total_exento: number
          total_a_pagar: number
          total_letras: string | null
          detalle: unknown
        }
      }
    }
    Functions: {
      aplicar_salidas_ingredientes_pedido: {
        Args: { p_movs: Json }
        Returns: null
      }
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
export type PrinterConfig = Database['public']['Tables']['printer_config']['Row']
export type TenantFacturacion = Database['public']['Tables']['tenant_facturacion']['Row']
export type Factura = Database['public']['Tables']['facturas']['Row']

export type ProductoCompleto = Database['public']['Views']['vista_productos_completos']['Row']
export type PedidoCompleto = Database['public']['Views']['vista_pedidos_completos']['Row']
export type TopCliente = Database['public']['Views']['vista_top_clientes']['Row']

// Tipos para inserts
export type NuevoProducto = Database['public']['Tables']['productos']['Insert']
export type NuevoCliente = Database['public']['Tables']['clientes']['Insert']
export type NuevoPedido = Database['public']['Tables']['pedidos']['Insert']
export type NuevoItemPedido = Database['public']['Tables']['items_pedido']['Insert']
export type NuevaFactura = Database['public']['Tables']['facturas']['Insert']

