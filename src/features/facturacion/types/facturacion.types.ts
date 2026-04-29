/**
 * Tipos para el servicio de facturación.
 * Estructura limpia con TODOS los datos que lleva una factura fiscal:
 *
 * EMISOR:     RUC, razón social, dirección, teléfono, email, actividad económica
 * RECEPTOR:   RUC, CI, nombre, dirección, teléfono, email
 * DOCUMENTO:  Número factura, timbrado, vigencia timbrado, fecha emisión
 * DETALLE:    Por línea: producto_nombre, cantidad, precio_unitario, subtotal, iva_porcentaje (5|10), monto_iva
 * TOTALES:    total_iva_10, total_iva_5, total_exento, total_a_pagar, total_letras
 *
 * Ver también: DATOS_FACTURA.md en este módulo.
 */

/** Una línea del detalle de la factura (producto/servicio con IVA discriminado) */
export interface DetalleFacturaItem {
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  iva_porcentaje: number
  monto_iva: number
}

/** Emisor (local/tenant) */
export interface FacturaEmisor {
  ruc: string | null
  razon_social: string
  direccion: string | null
  telefono: string | null
  email: string | null
  actividad_economica: string | null
}

/** Receptor (cliente) */
export interface FacturaReceptor {
  ruc: string | null
  ci: string | null
  nombre: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
}

/** Documento (timbrado, numeración, fecha) */
export interface FacturaDocumento {
  numero_factura: string
  timbrado: string
  timbrado_vigencia_inicio: string
  timbrado_vigencia_fin: string
  fecha_emision: string
}

/** Totales e IVA discriminado */
export interface FacturaTotales {
  total_iva_10: number
  total_iva_5: number
  total_exento: number
  total_a_pagar: number
  total_letras: string | null
}

/**
 * Factura completa para impresión o consumo del agente.
 * Incluye: RUC/razón social/dirección emisor y receptor,
 * timbrado vigente, numeración consecutiva, fecha de emisión,
 * detalle de productos con IVA 5% o 10%, total a pagar.
 */
export interface FacturaParaImpresion {
  factura_id: string
  pedido_id: string
  tenant_id: string
  numero_pedido: number
  mesa_numero: number | null
  saludo_final: string

  emisor: FacturaEmisor
  receptor: FacturaReceptor
  documento: FacturaDocumento
  totales: FacturaTotales
  detalle: DetalleFacturaItem[]
}
