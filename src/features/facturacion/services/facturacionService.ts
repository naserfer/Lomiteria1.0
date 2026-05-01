/**
 * Servicio de facturación.
 * Expone facturas completas para impresión o consumo: emisor, receptor,
 * timbrado vigente, numeración, fecha, detalle con IVA, total a pagar.
 * Usa la vista vista_factura_impresion (tabla expuesta para la impresora).
 */

import { createClient } from '@/lib/supabase/client'
import type { FacturaParaImpresion, DetalleFacturaItem } from '../types/facturacion.types'

/** Fila raw de la vista vista_factura_impresion */
interface VistaFacturaImpresionRow {
  factura_id: string
  pedido_id: string
  tenant_id: string
  numero_pedido: number
  mesa_numero: number | null
  saludo_final: string | null
  metodo_cobro: string | null
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
  detalle: DetalleFacturaItem[] | null
}

function mapRowToFactura(row: VistaFacturaImpresionRow): FacturaParaImpresion {
  return {
    factura_id: row.factura_id,
    pedido_id: row.pedido_id,
    tenant_id: row.tenant_id,
    numero_pedido: row.numero_pedido,
    mesa_numero: row.mesa_numero,
    saludo_final: row.saludo_final ?? '¡Gracias por tu compra!',
    metodo_cobro: row.metodo_cobro,

    emisor: {
      ruc: row.emisor_ruc,
      razon_social: row.emisor_razon_social ?? '',
      direccion: row.emisor_direccion,
      telefono: row.emisor_telefono,
      email: row.emisor_email,
      actividad_economica: row.emisor_actividad_economica,
    },

    receptor: {
      ruc: row.receptor_ruc,
      ci: row.receptor_ci,
      nombre: row.receptor_nombre,
      direccion: row.receptor_direccion,
      telefono: row.receptor_telefono,
      email: row.receptor_email,
    },

    documento: {
      numero_factura: row.numero_factura,
      timbrado: row.timbrado,
      timbrado_vigencia_inicio: row.timbrado_vigencia_inicio,
      timbrado_vigencia_fin: row.timbrado_vigencia_fin,
      fecha_emision: row.fecha_emision,
    },

    totales: {
      total_iva_10: Number(row.total_iva_10),
      total_iva_5: Number(row.total_iva_5),
      total_exento: Number(row.total_exento),
      total_a_pagar: Number(row.total_a_pagar),
      total_letras: row.total_letras,
    },

    detalle: Array.isArray(row.detalle) ? row.detalle : [],
  }
}

export const facturacionService = {
  /**
   * Obtiene la factura completa para impresión por ID de factura.
   * Incluye: RUC, razón social y dirección del emisor y receptor,
   * timbrado vigente, numeración consecutiva, fecha de emisión,
   * detalle de productos/servicios, IVA discriminado (5% o 10%), total a pagar.
   */
  async getFacturaParaImpresionPorId(facturaId: string): Promise<FacturaParaImpresion | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vista_factura_impresion')
      .select('*')
      .eq('factura_id', facturaId)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo factura para impresión:', error)
      return null
    }
    if (!data) return null

    return mapRowToFactura(data as VistaFacturaImpresionRow)
  },

  /**
   * Obtiene la factura completa para impresión por ID de pedido.
   * Útil cuando el agente de impresión recibe un pedido_id (Realtime) y debe imprimir la factura.
   */
  async getFacturaParaImpresionPorPedidoId(pedidoId: string): Promise<FacturaParaImpresion | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vista_factura_impresion')
      .select('*')
      .eq('pedido_id', pedidoId)
      .maybeSingle()

    if (error) {
      console.error('Error obteniendo factura por pedido:', error)
      return null
    }
    if (!data) return null

    return mapRowToFactura(data as VistaFacturaImpresionRow)
  },
}
