import { createClient } from '@/lib/supabase/client'
import type { HistorialPedidosFilters, PedidoParaHistorial } from '../types/pedidos.types'

function buildItemsPreview(
  raw: Array<{ producto_nombre: string; cantidad: number; created_at?: string }> | null | undefined
): string {
  const list = raw ?? []
  if (list.length === 0) return 'Sin ítems'

  const sorted = [...list].sort((a, b) =>
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  )
  const head = sorted.slice(0, 3).map((i) => `${i.producto_nombre} ×${i.cantidad}`)
  const more = sorted.length > 3 ? '…' : ''
  const n = sorted.length
  return `${n} línea${n !== 1 ? 's' : ''} · ${head.join(', ')}${more}`
}

export const pedidosService = {
  async listForHistorial(
    tenantId: string,
    filters: HistorialPedidosFilters
  ): Promise<{ data: PedidoParaHistorial[]; error: Error | null }> {
    const supabase = createClient()

    let query = supabase
      .from('pedidos')
      .select(
        `
        id,
        numero_pedido,
        pedido_ciclo,
        tenant_id,
        cliente_id,
        usuario_id,
        tipo,
        estado,
        estado_pedido,
        total,
        puntos_generados,
        created_at,
        cancelado_por_id,
        cancelado_at,
        motivo_cancelacion,
        notas,
        clientes:cliente_id(nombre, telefono, direccion),
        usuarios:usuario_id(nombre),
        items_pedido(producto_nombre, cantidad, created_at),
        facturas(id, anulada)
      `
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filters.fechaDesde) {
      query = query.gte('created_at', `${filters.fechaDesde}T00:00:00.000Z`)
    }
    if (filters.fechaHasta) {
      query = query.lte('created_at', `${filters.fechaHasta}T23:59:59.999Z`)
    }
    if (filters.estadoPedido !== 'todos') {
      query = query.eq('estado_pedido', filters.estadoPedido)
    }
    if (filters.numeroPedido.trim()) {
      const num = parseInt(filters.numeroPedido, 10)
      if (!Number.isNaN(num)) {
        query = query.eq('numero_pedido', num)
      }
    }

    const { data, error } = await query.limit(200)

    if (error) {
      return { data: [], error: new Error(error.message) }
    }

    const rows: PedidoParaHistorial[] = (data ?? []).map((row: Record<string, unknown>) => {
      const facturasRaw = row.facturas as { id: string; anulada: boolean } | { id: string; anulada: boolean }[] | null
      const facturaArr = Array.isArray(facturasRaw) ? facturasRaw : facturasRaw ? [facturasRaw] : []
      const f0 = facturaArr[0]
      const factura_imprimible = Boolean(f0 && !f0.anulada)

      const cli = row.clientes as {
        nombre: string | null
        telefono: string | null
        direccion: string | null
      } | null

      const itemsRaw = row.items_pedido as
        | Array<{ producto_nombre: string; cantidad: number; created_at?: string }>
        | null

      return {
        id: row.id as string,
        numero_pedido: row.numero_pedido as number,
        pedido_ciclo: Number(row.pedido_ciclo ?? 1),
        tenant_id: row.tenant_id as string,
        cliente_id: row.cliente_id as string | null,
        usuario_id: row.usuario_id as string | null,
        tipo: row.tipo as 'local' | 'delivery' | 'para_llevar',
        estado: row.estado as string,
        estado_pedido: row.estado_pedido as string,
        total: Number(row.total),
        puntos_generados: Number(row.puntos_generados ?? 0),
        created_at: row.created_at as string,
        cancelado_por_id: row.cancelado_por_id as string | null,
        cancelado_at: row.cancelado_at as string | null,
        motivo_cancelacion: row.motivo_cancelacion as string | null,
        cliente_nombre: cli?.nombre ?? null,
        cliente_telefono: cli?.telefono ?? null,
        cliente_direccion: cli?.direccion ?? null,
        usuario_nombre: (row.usuarios as { nombre: string | null } | null)?.nombre ?? null,
        notas: (row.notas as string | null) ?? null,
        items_preview: buildItemsPreview(itemsRaw),
        factura_imprimible,
      }
    })

    return { data: rows, error: null }
  }
}
