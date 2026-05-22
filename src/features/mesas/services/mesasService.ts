import { createClient } from '@/lib/supabase/client'
import { requestAgentPrint } from '@/features/impresion/agentPrintClient'
import { revertirIngredientesPorItemPedido, type ItemPedidoForRevert } from '@/lib/inventory/consumption'
import { broadcastMesasChanged, broadcastReservasChanged } from './mesasRealtimeBroadcast'
import type { EstadoMesa, Mesa, MesaReserva, MesaUnion, MesaUnionItem, PedidoDivision, ResumenMesa } from '../types/mesas.types'

const MESAS_SELECT = 'id, tenant_id, numero, nombre, capacidad, estado, activa, orden, created_at, updated_at'

/** Ediciones en detalle de mesa: cocina debe ver el pedido actualizado (agente vía `reprint_solicitud`). */
function enqueueReprintCocinaTrasEdicionDetalle(pedidoId: string, tenantId: string): void {
  void requestAgentPrint(pedidoId, 'cocina', tenantId).catch((err: unknown) => {
    console.warn('[mesasService] No se pudo encolar reimpresión cocina tras edición en detalle:', err)
  })
}

/** Precio lista incluye IVA: desglosa `monto_iva` por línea (criterio alineado a facturación típica PY). */
function montoIvaLineaDesdeSubtotalIncluido(
  subtotalIncluido: number,
  tasaIva: number
): { iva_porcentaje: number; monto_iva: number } {
  const t = Number(tasaIva)
  if (!Number.isFinite(t) || t <= 0) return { iva_porcentaje: 0, monto_iva: 0 }
  if (Math.abs(t - 10) < 0.01) {
    const neto = subtotalIncluido / 1.1
    return {
      iva_porcentaje: 10,
      monto_iva: Math.round((subtotalIncluido - neto) * 100) / 100,
    }
  }
  if (Math.abs(t - 5) < 0.01) {
    const neto = subtotalIncluido / 1.05
    return {
      iva_porcentaje: 5,
      monto_iva: Math.round((subtotalIncluido - neto) * 100) / 100,
    }
  }
  return { iva_porcentaje: Math.round(t), monto_iva: 0 }
}

export const mesasService = {
  async getOrCreateVirtualTakeawayMesa(tenantId: string): Promise<Mesa> {
    const supabase = createClient()
    const virtualName = '__virtual_para_llevar__'

    const { data: existing, error: existingError } = await supabase
      .from('mesas')
      .select(MESAS_SELECT)
      .eq('tenant_id', tenantId)
      .eq('nombre', virtualName)
      .eq('activa', true)
      .maybeSingle()

    if (existingError) {
      throw new Error(`No se pudo consultar mesa virtual para llevar: ${existingError.message}`)
    }
    if (existing) return existing as Mesa

    const { data: maxNumeroRow, error: maxNumeroError } = await supabase
      .from('mesas')
      .select('numero')
      .eq('tenant_id', tenantId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxNumeroError) {
      throw new Error(`No se pudo calcular número de mesa virtual: ${maxNumeroError.message}`)
    }

    const nextNumero = Math.max(1, Number(maxNumeroRow?.numero ?? 0) + 1)
    const { data: inserted, error: insertError } = await supabase
      .from('mesas')
      .insert({
        tenant_id: tenantId,
        numero: nextNumero,
        nombre: virtualName,
        capacidad: 1,
        estado: 'ocupada',
        activa: true,
        orden: nextNumero,
      })
      .select(MESAS_SELECT)
      .single()

    if (insertError || !inserted) {
      throw new Error(`No se pudo crear mesa virtual para llevar: ${insertError?.message ?? 'sin datos'}`)
    }

    return inserted as Mesa
  },

  async deleteVirtualTakeawayMesa(params: { tenantId: string; mesaId: string }): Promise<void> {
    const supabase = createClient()
    const virtualName = '__virtual_para_llevar__'
    // Para poder eliminar la mesa virtual, desvinculamos historial ya cerrado.
    const { error: unlinkError } = await supabase
      .from('pedidos')
      .update({ mesa_id: null, updated_at: new Date().toISOString() })
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .in('estado_pedido', ['FACT', 'ANUL'])

    if (unlinkError) {
      throw new Error(`No se pudo desvincular pedidos de la mesa virtual: ${unlinkError.message}`)
    }

    const { error } = await supabase
      .from('mesas')
      .delete()
      .eq('tenant_id', params.tenantId)
      .eq('id', params.mesaId)
      .eq('nombre', virtualName)

    if (error) {
      throw new Error(`No se pudo eliminar mesa virtual para llevar: ${error.message}`)
    }
  },

  async updateItemCustomizacionExtraPrecio(params: {
    tenantId: string
    customizacionId: string
    precioExtraGs: number
  }): Promise<void> {
    const supabase = createClient()
    const precioExtra = Math.max(0, Math.round(Number(params.precioExtraGs) || 0))

    const { data: custom, error: customError } = await supabase
      .from('items_pedido_customizacion')
      .select(`
        id,
        tipo,
        precio_extra,
        item_pedido_id
      `)
      .eq('id', params.customizacionId)
      .single()

    if (customError || !custom) {
      throw new Error('No se pudo cargar el extra para actualizar su precio.')
    }
    if (custom.tipo !== 'extra') {
      throw new Error('Solo se puede editar el precio de customizaciones tipo extra.')
    }

    const { data: itemRow, error: itemError } = await supabase
      .from('items_pedido')
      .select(`
        id,
        pedido_id,
        subtotal,
        pedidos!inner (
          id,
          tenant_id,
          total,
          estado,
          estado_pedido
        )
      `)
      .eq('id', custom.item_pedido_id)
      .eq('pedidos.tenant_id', params.tenantId)
      .single()

    if (itemError || !itemRow) {
      throw new Error('No se pudo validar el ítem asociado al extra.')
    }

    const item = itemRow
    const pedido = Array.isArray(item.pedidos) ? item.pedidos[0] : item.pedidos
    if (!item || !pedido) throw new Error('No se pudo validar el pedido asociado al extra.')
    if (pedido.estado === 'cancelado') throw new Error('No se puede editar un pedido cancelado.')
    if (!['EDIT', 'FACT'].includes(pedido.estado_pedido)) {
      throw new Error('Solo se pueden editar pedidos abiertos o confirmados.')
    }

    const { data: extrasRows, error: extrasError } = await supabase
      .from('items_pedido_customizacion')
      .select('id, precio_extra')
      .eq('item_pedido_id', item.id)
      .eq('tipo', 'extra')

    if (extrasError) {
      throw new Error(`No se pudieron cargar los extras del ítem: ${extrasError.message}`)
    }

    const sumExtrasActual = (extrasRows ?? []).reduce((sum, row) => sum + Number(row.precio_extra ?? 0), 0)
    const prevPrecioExtra = Number(custom.precio_extra ?? 0)
    const sumExtrasNuevo = sumExtrasActual - prevPrecioExtra + precioExtra

    const subtotalActual = Number(item.subtotal ?? 0)
    const totalPedidoActual = Number(pedido.total ?? 0)
    const subtotalBase = Math.max(0, subtotalActual - sumExtrasActual)
    const nuevoSubtotal = Math.max(0, subtotalBase + sumExtrasNuevo)
    const delta = nuevoSubtotal - subtotalActual
    const nuevoTotalPedido = Math.max(0, totalPedidoActual + delta)

    const { error: updateCustomError } = await supabase
      .from('items_pedido_customizacion')
      .update({ precio_extra: precioExtra })
      .eq('id', params.customizacionId)

    if (updateCustomError) {
      throw new Error(`No se pudo actualizar el precio del extra: ${updateCustomError.message}`)
    }

    const { error: updateItemError } = await supabase
      .from('items_pedido')
      .update({ subtotal: nuevoSubtotal })
      .eq('id', item.id)

    if (updateItemError) {
      throw new Error(`No se pudo actualizar el subtotal del ítem: ${updateItemError.message}`)
    }

    const { error: updatePedidoError } = await supabase
      .from('pedidos')
      .update({ total: nuevoTotalPedido, updated_at: new Date().toISOString() })
      .eq('id', item.pedido_id)
      .eq('tenant_id', params.tenantId)

    if (updatePedidoError) {
      throw new Error(`No se pudo actualizar el total del pedido: ${updatePedidoError.message}`)
    }

    enqueueReprintCocinaTrasEdicionDetalle(item.pedido_id, params.tenantId)
  },

  async updateItemPedidoRecargo(params: {
    tenantId: string
    itemPedidoId: string
    extraGs: number
    mode?: 'line_total' | 'note_extra'
  }): Promise<{
    pedidoId: string
    itemPedidoId: string
    nuevoSubtotal: number
    nuevoTotalPedido: number
  }> {
    const supabase = createClient()
    const extraGs = Math.max(0, Math.round(Number(params.extraGs) || 0))
    const mode = params.mode ?? 'line_total'

    const { data: itemRow, error: itemError } = await supabase
      .from('items_pedido')
      .select(`
        id,
        pedido_id,
        producto_id,
        cantidad,
        precio_unitario,
        subtotal,
        notas,
        pedidos!inner (
          id,
          tenant_id,
          total,
          estado,
          estado_pedido
        )
      `)
      .eq('id', params.itemPedidoId)
      .eq('pedidos.tenant_id', params.tenantId)
      .single()

    if (itemError || !itemRow) {
      throw new Error('No se pudo cargar el ítem del pedido para ajustar recargo.')
    }

    const pedido = Array.isArray(itemRow.pedidos) ? itemRow.pedidos[0] : itemRow.pedidos
    if (!pedido) throw new Error('No se pudo validar el pedido del ítem.')
    if (pedido.estado === 'cancelado') throw new Error('No se puede editar un pedido cancelado.')
    if (!['EDIT', 'FACT'].includes(pedido.estado_pedido)) {
      throw new Error('Solo se pueden editar pedidos abiertos o confirmados.')
    }

    const cantidad = Math.max(1, Number(itemRow.cantidad ?? 1))
    const subtotalActual = Number(itemRow.subtotal ?? 0)
    const totalPedidoActual = Number(pedido.total ?? 0)
    const baseActual = Math.max(0, Number(itemRow.precio_unitario ?? 0) * cantidad)
    const recargosActuales = Math.max(0, subtotalActual - baseActual)
    const nowIso = new Date().toISOString()

    const { data: noteExtraRows, error: noteExtraError } = await supabase
      .from('items_pedido_customizacion')
      .select('id, precio_extra')
      .eq('item_pedido_id', params.itemPedidoId)
      .eq('tipo', 'extra')
      .is('ingrediente_id', null)
      .like('motivo', 'Nota:%')
      .order('created_at', { ascending: true })

    if (noteExtraError) {
      throw new Error(`No se pudo sincronizar customización de nota: ${noteExtraError.message}`)
    }

    const { data: allExtraRows, error: allExtraError } = await supabase
      .from('items_pedido_customizacion')
      .select('precio_extra')
      .eq('item_pedido_id', params.itemPedidoId)
      .eq('tipo', 'extra')

    if (allExtraError) {
      throw new Error(`No se pudieron cargar extras del ítem: ${allExtraError.message}`)
    }

    const noteExtraIds = (noteExtraRows ?? []).map((r) => r.id)
    const noteExtraId = noteExtraIds[0] ?? null
    const duplicateIds = noteExtraIds.slice(1)
    const noteExtraActual = (noteExtraRows ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.precio_extra ?? 0)),
      0
    )
    const extrasRegistrados = (allExtraRows ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.precio_extra ?? 0)),
      0
    )
    const otrosRecargosRegistrados = Math.max(0, extrasRegistrados - noteExtraActual)
    const residualNoRegistrado = Math.max(0, recargosActuales - extrasRegistrados)

    const baseFinal = mode === 'line_total' ? extraGs : baseActual
    const noteExtraFinal = mode === 'note_extra' ? extraGs : noteExtraActual
    const subtotalFinal = Math.max(
      0,
      baseFinal + otrosRecargosRegistrados + noteExtraFinal + residualNoRegistrado
    )
    const precioUnitarioFinal = Math.max(0, Math.round(baseFinal / cantidad))
    const deltaFinal = subtotalFinal - subtotalActual
    const totalPedidoFinal = Math.max(0, totalPedidoActual + deltaFinal)

    const { error: updateItemError } = await supabase
      .from('items_pedido')
      .update({ precio_unitario: precioUnitarioFinal, subtotal: subtotalFinal })
      .eq('id', params.itemPedidoId)

    if (updateItemError) {
      throw new Error(`No se pudo actualizar subtotal del ítem: ${updateItemError.message}`)
    }

    const { error: updatePedidoError } = await supabase
      .from('pedidos')
      .update({ total: totalPedidoFinal, updated_at: nowIso })
      .eq('id', itemRow.pedido_id)
      .eq('tenant_id', params.tenantId)

    if (updatePedidoError) {
      throw new Error(`No se pudo actualizar el total del pedido: ${updatePedidoError.message}`)
    }

    if (mode === 'note_extra') {
      if (noteExtraFinal > 0) {
        const motivoNota = (itemRow.notas ?? '').trim() || 'Recargo por nota'
        const payload = {
          tipo: 'extra' as const,
          ingrediente_id: null,
          cantidad_original: 0,
          cantidad_ajustada: 1,
          precio_extra: noteExtraFinal,
          motivo: `Nota: ${motivoNota}`,
        }

        if (noteExtraId) {
          const { error: updateNoteExtraError } = await supabase
            .from('items_pedido_customizacion')
            .update(payload)
            .eq('id', noteExtraId)
            .eq('item_pedido_id', params.itemPedidoId)
          if (updateNoteExtraError) {
            throw new Error(`No se pudo actualizar recargo de nota en customizaciones: ${updateNoteExtraError.message}`)
          }
        } else {
          const { error: insertNoteExtraError } = await supabase
            .from('items_pedido_customizacion')
            .insert({
              item_pedido_id: params.itemPedidoId,
              ...payload,
            })
          if (insertNoteExtraError) {
            throw new Error(`No se pudo insertar recargo de nota en customizaciones: ${insertNoteExtraError.message}`)
          }
        }
      } else if (noteExtraIds.length > 0) {
        const { error: deleteNoteExtraError } = await supabase
          .from('items_pedido_customizacion')
          .delete()
          .in('id', noteExtraIds)
        if (deleteNoteExtraError) {
          throw new Error(`No se pudo limpiar recargo de nota en customizaciones: ${deleteNoteExtraError.message}`)
        }
      }

      if (duplicateIds.length > 0) {
        const { error: cleanupDupError } = await supabase
          .from('items_pedido_customizacion')
          .delete()
          .in('id', duplicateIds)
        if (cleanupDupError) {
          throw new Error(`No se pudo limpiar duplicados de recargo de nota: ${cleanupDupError.message}`)
        }
      }
    }

    enqueueReprintCocinaTrasEdicionDetalle(itemRow.pedido_id, params.tenantId)

    return {
      pedidoId: itemRow.pedido_id,
      itemPedidoId: itemRow.id,
      nuevoSubtotal: subtotalFinal,
      nuevoTotalPedido: totalPedidoFinal,
    }
  },

  async listMesas(tenantId: string): Promise<Mesa[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesas')
      .select(MESAS_SELECT)
      .eq('tenant_id', tenantId)
      .eq('activa', true)
      .order('orden', { ascending: true })
      .order('numero', { ascending: true })

    if (error) throw error
    return (data ?? []) as Mesa[]
  },

  async createMesa(input: {
    tenantId: string
    numero: number
    nombre?: string | null
    capacidad?: number
    orden?: number
  }): Promise<Mesa> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesas')
      .insert({
        tenant_id: input.tenantId,
        numero: input.numero,
        nombre: input.nombre ?? null,
        capacidad: input.capacidad ?? 4,
        orden: input.orden ?? input.numero,
        estado: 'libre',
        activa: true,
      })
      .select(MESAS_SELECT)
      .single()

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: input.tenantId,
      mesa_id: data.id,
      tipo: 'crear_mesa',
      payload: { numero: input.numero, capacidad: input.capacidad ?? 4 },
    })
    return data as Mesa
  },

  async updateMesa(
    tenantId: string,
    mesaId: string,
    patch: Partial<Pick<Mesa, 'numero' | 'nombre' | 'capacidad' | 'orden' | 'activa'>>
  ): Promise<Mesa> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesas')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', mesaId)
      .select(MESAS_SELECT)
      .single()

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: tenantId,
      mesa_id: mesaId,
      tipo: 'editar_mesa',
      payload: patch,
    })
    return data as Mesa
  },

  async deleteMesa(params: {
    tenantId: string
    mesaId: string
    deletedBy?: string | null
    reason?: string | null
  }): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('mesas')
      .update({
        activa: false,
        estado: 'libre',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', params.tenantId)
      .eq('id', params.mesaId)

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: params.tenantId,
      mesa_id: params.mesaId,
      usuario_id: params.deletedBy ?? null,
      tipo: 'editar_mesa',
      payload: {
        action: 'delete_mesa',
        activa: false,
        reason: params.reason ?? 'manual_admin',
      },
    })
  },

  async setEstadoMesa(tenantId: string, mesaId: string, estado: EstadoMesa): Promise<Mesa> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesas')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', mesaId)
      .select(MESAS_SELECT)
      .single()

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: tenantId,
      mesa_id: mesaId,
      tipo:
        estado === 'reservada'
          ? 'reservar_mesa'
          : estado === 'bloqueada'
            ? 'bloquear_mesa'
            : estado === 'libre'
              ? 'liberar_mesa'
              : 'ocupar_mesa',
      payload: { estado },
    })
    void broadcastMesasChanged(tenantId, `setEstadoMesa:${estado}`)
    return data as Mesa
  },

  async openPosFromMesa(tenantId: string, mesaId: string): Promise<Mesa> {
    return this.setEstadoMesa(tenantId, mesaId, 'ocupada')
  },

  async liberarMesa(tenantId: string, mesaId: string): Promise<Mesa> {
    return this.setEstadoMesa(tenantId, mesaId, 'libre')
  },

  async listReservas(tenantId: string): Promise<MesaReserva[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesa_reservas')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('inicio_at', { ascending: true })

    if (error) throw error
    return (data ?? []) as MesaReserva[]
  },

  async createReserva(input: {
    tenantId: string
    mesaId: string
    nombre: string
    telefono?: string | null
    cantidadPersonas?: number | null
    inicioAt: string
    finAt?: string | null
    notas?: string | null
    createdBy?: string | null
  }): Promise<MesaReserva> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesa_reservas')
      .insert({
        tenant_id: input.tenantId,
        mesa_id: input.mesaId,
        nombre_reserva: input.nombre,
        telefono: input.telefono ?? null,
        cantidad_personas: input.cantidadPersonas ?? null,
        inicio_at: input.inicioAt,
        fin_at: input.finAt ?? null,
        estado: 'pendiente',
        notas: input.notas ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: input.tenantId,
      mesa_id: input.mesaId,
      usuario_id: input.createdBy ?? null,
      tipo: 'reservar_mesa',
      payload: { nombre: input.nombre, inicioAt: input.inicioAt },
    })
    void broadcastReservasChanged(input.tenantId, 'createReserva')
    return data as MesaReserva
  },

  async updateReservaEstado(
    tenantId: string,
    reservaId: string,
    estado: MesaReserva['estado']
  ): Promise<MesaReserva> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('mesa_reservas')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', reservaId)
      .select('*')
      .single()

    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: tenantId,
      mesa_id: data.mesa_id,
      usuario_id: data.created_by,
      tipo: estado === 'cancelada' ? 'cancelar_reserva' : 'confirmar_reserva',
      payload: { reservaId, estado },
    })
    void broadcastReservasChanged(tenantId, `updateReservaEstado:${estado}`)
    return data as MesaReserva
  },

  async deleteReserva(tenantId: string, reservaId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('mesa_reservas')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', reservaId)
    if (error) throw error
    void broadcastReservasChanged(tenantId, 'deleteReserva')
  },

  async moverPedidoAMesa(params: {
    tenantId: string
    pedidoId: string
    mesaDestinoId: string
    usuarioId?: string | null
  }): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.rpc('mover_pedido_mesa', {
      p_tenant_id: params.tenantId,
      p_pedido_id: params.pedidoId,
      p_mesa_destino_id: params.mesaDestinoId,
      p_usuario_id: params.usuarioId ?? null,
    })
    if (error) throw error
  },

  async moverUltimoPedidoMesa(params: {
    tenantId: string
    mesaOrigenId: string
    mesaDestinoId: string
    usuarioId?: string | null
  }): Promise<void> {
    if (params.mesaOrigenId === params.mesaDestinoId) {
      throw new Error('La mesa origen y destino no pueden ser la misma.')
    }

    const supabase = createClient()
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaOrigenId)
      .eq('estado_pedido', 'FACT')
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pedidoError) throw pedidoError
    if (!pedido?.id) {
      throw new Error('No hay un pedido activo en la mesa origen para mover.')
    }

    await this.moverPedidoAMesa({
      tenantId: params.tenantId,
      pedidoId: pedido.id,
      mesaDestinoId: params.mesaDestinoId,
      usuarioId: params.usuarioId ?? null,
    })
  },

  async crearUnionMesas(params: {
    tenantId: string
    mesaIds: string[]
    usuarioId?: string | null
    codigo?: string | null
  }): Promise<{ union: MesaUnion; items: MesaUnionItem[] }> {
    if (params.mesaIds.length < 2) {
      throw new Error('Debes seleccionar al menos 2 mesas para unir.')
    }

    const supabase = createClient()
    const { data: union, error: unionError } = await supabase
      .from('mesa_uniones')
      .insert({
        tenant_id: params.tenantId,
        codigo: params.codigo ?? null,
        estado: 'activa',
        created_by: params.usuarioId ?? null,
      })
      .select('*')
      .single()
    if (unionError) throw unionError

    const itemsPayload = params.mesaIds.map((mesaId) => ({
      tenant_id: params.tenantId,
      union_id: union.id,
      mesa_id: mesaId,
    }))
    const { data: items, error: itemsError } = await supabase
      .from('mesa_union_items')
      .insert(itemsPayload)
      .select('*')
    if (itemsError) throw itemsError

    await supabase.from('mesas').update({ estado: 'ocupada' }).eq('tenant_id', params.tenantId).in('id', params.mesaIds)
    await supabase.from('mesa_eventos').insert({
      tenant_id: params.tenantId,
      usuario_id: params.usuarioId ?? null,
      tipo: 'unir_mesas',
      payload: { unionId: union.id, mesaIds: params.mesaIds, codigo: params.codigo ?? null },
    })

    return { union: union as MesaUnion, items: (items ?? []) as MesaUnionItem[] }
  },

  async listUnionesActivas(tenantId: string): Promise<Array<MesaUnion & { mesas: string[] }>> {
    const supabase = createClient()
    const { data: unions, error: unionError } = await supabase
      .from('mesa_uniones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
    if (unionError) throw unionError

    if (!unions || unions.length === 0) return []

    const unionIds = unions.map((u) => u.id)
    const { data: items, error: itemError } = await supabase
      .from('mesa_union_items')
      .select('union_id, mesa_id')
      .eq('tenant_id', tenantId)
      .in('union_id', unionIds)
    if (itemError) throw itemError

    const map = new Map<string, string[]>()
    ;(items ?? []).forEach((it) => {
      const arr = map.get(it.union_id) ?? []
      arr.push(it.mesa_id)
      map.set(it.union_id, arr)
    })

    return unions.map((u) => ({
      ...(u as MesaUnion),
      mesas: map.get(u.id) ?? [],
    }))
  },

  async cerrarUnionMesas(tenantId: string, unionId: string, usuarioId?: string | null): Promise<void> {
    const supabase = createClient()
    const { data: items, error: itemsError } = await supabase
      .from('mesa_union_items')
      .select('mesa_id')
      .eq('tenant_id', tenantId)
      .eq('union_id', unionId)
    if (itemsError) throw itemsError

    const mesaIds = (items ?? []).map((x) => x.mesa_id)
    if (mesaIds.length > 0) {
      await supabase.from('mesas').update({ estado: 'libre' }).eq('tenant_id', tenantId).in('id', mesaIds)
    }

    const { error } = await supabase
      .from('mesa_uniones')
      .update({ estado: 'cerrada', closed_at: new Date().toISOString(), created_by: usuarioId ?? null })
      .eq('tenant_id', tenantId)
      .eq('id', unionId)
    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: tenantId,
      usuario_id: usuarioId ?? null,
      tipo: 'cerrar_union',
      payload: { unionId, mesaIds },
    })
  },

  async dividirPedido(params: {
    tenantId: string
    pedidoPadreId: string
    pedidoHijoId: string
    monto: number
    createdBy?: string | null
  }): Promise<PedidoDivision> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('pedido_divisiones')
      .insert({
        tenant_id: params.tenantId,
        pedido_padre_id: params.pedidoPadreId,
        pedido_hijo_id: params.pedidoHijoId,
        monto: params.monto,
        created_by: params.createdBy ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    await supabase.from('mesa_eventos').insert({
      tenant_id: params.tenantId,
      pedido_id: params.pedidoPadreId,
      usuario_id: params.createdBy ?? null,
      tipo: 'dividir_cuenta',
      payload: { pedidoPadreId: params.pedidoPadreId, pedidoHijoId: params.pedidoHijoId, monto: params.monto },
    })
    return data as PedidoDivision
  },

  async dividirUltimoPedidoMesaEntre(params: {
    tenantId: string
    mesaId: string
    partes: number
    createdBy?: string | null
  }): Promise<{ pedidoPadreId: string; partes: number; montos: number[] }> {
    const supabase = createClient()
    const partes = Math.floor(params.partes)
    if (!Number.isFinite(partes) || partes < 2 || partes > 12) {
      throw new Error('La división debe ser entre 2 y 12 partes.')
    }

    const { data: pedidoPadre, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, tenant_id, cliente_id, usuario_id, tipo, total, estado, estado_pedido, mesa_id')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .eq('estado_pedido', 'FACT')
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pedidoError) throw pedidoError
    if (!pedidoPadre?.id) {
      throw new Error('No hay un pedido confirmado en esta mesa para dividir.')
    }

    const total = Number(pedidoPadre.total ?? 0)
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error('El pedido no tiene total válido para dividir.')
    }

    const totalCents = Math.round(total * 100)
    const basePart = Math.floor(totalCents / partes)
    const remainder = totalCents - basePart * partes
    const montosCents = Array.from({ length: partes }, (_, idx) => basePart + (idx < remainder ? 1 : 0))
    const montos = montosCents.map((m) => Number((m / 100).toFixed(2)))

    for (let i = 0; i < montos.length; i += 1) {
      const monto = montos[i]
      // Creamos un pedido hijo contable para representar cada parte.
      // Se guarda en EDIT para no disparar procesos operativos de cocina/facturación.
      // eslint-disable-next-line no-await-in-loop
      const { data: pedidoHijo, error: hijoError } = await supabase
        .from('pedidos')
        .insert({
          tenant_id: params.tenantId,
          cliente_id: pedidoPadre.cliente_id,
          usuario_id: params.createdBy ?? pedidoPadre.usuario_id,
          tipo: pedidoPadre.tipo,
          estado: 'pendiente',
          estado_pedido: 'EDIT',
          total: monto,
          puntos_generados: 0,
          mesa_id: params.mesaId,
          notas: `DIVISION ${i + 1}/${partes} del pedido ${pedidoPadre.id}`
        })
        .select('id')
        .single()
      if (hijoError) throw hijoError

      // eslint-disable-next-line no-await-in-loop
      await this.dividirPedido({
        tenantId: params.tenantId,
        pedidoPadreId: pedidoPadre.id,
        pedidoHijoId: pedidoHijo.id,
        monto,
        createdBy: params.createdBy ?? null
      })
    }

    return { pedidoPadreId: pedidoPadre.id, partes, montos }
  },

  async getResumenPedidosMesas(
    tenantId: string,
    mesas: Array<{ id: string; updated_at: string }>
  ): Promise<ResumenMesa[]> {
    if (mesas.length === 0) return []
    const supabase = createClient()
    const mesaIds = mesas.map((m) => m.id)

    // Cortar por sesión real: último liberar_mesa por cada mesa.
    // Si la mesa nunca fue liberada NO se aplica cutoff: no hay sesión anterior que descartar.
    // Antes había un fallback a mesa.updated_at, pero ese campo lo mueve cualquier UPDATE
    // (editar nombre/capacidad, ocupar_mesa, setEstadoMesa, etc.) y terminaba ocultando pedidos
    // legítimos cuando mesa.updated_at quedaba > pedido.created_at.
    const { data: eventosLiberar, error: eventosLiberarError } = await supabase
      .from('mesa_eventos')
      .select('mesa_id, created_at')
      .eq('tenant_id', tenantId)
      .in('mesa_id', mesaIds)
      .eq('tipo', 'liberar_mesa')
      .order('created_at', { ascending: false })

    if (eventosLiberarError) throw eventosLiberarError

    const cutoffBySesion: Record<string, string> = {}
    for (const ev of eventosLiberar ?? []) {
      if (!ev?.mesa_id || !ev?.created_at) continue
      if (!cutoffBySesion[ev.mesa_id]) {
        cutoffBySesion[ev.mesa_id] = ev.created_at
      }
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        estado_pedido,
        total,
        mesa_id,
        created_at,
        items_pedido (
          id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          subtotal,
          notas,
          items_pedido_customizacion (
            id,
            tipo,
            precio_extra,
            motivo,
            ingredientes:ingrediente_id (
              nombre
            )
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .in('mesa_id', mesaIds)
      .in('estado_pedido', ['EDIT', 'FACT'])
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: true })

    if (error) throw error

    // Agrupa por mesa y descarta pedidos de sesiones anteriores
    const byMesa = new Map<string, ResumenMesa>()
    for (const p of (data ?? [])) {
      const mesaId = p.mesa_id as string
      const cutoff = cutoffBySesion[mesaId]
      // Excluir pedidos de sesiones anteriores. Estricto (<) para no descartar pedidos
      // creados en el mismo instante que el liberar_mesa por colisiones de microsegundos.
      if (cutoff && p.created_at < cutoff) continue

      if (!byMesa.has(mesaId)) {
        byMesa.set(mesaId, { mesa_id: mesaId, pedidos: [], total_items: 0, total_acumulado: 0 })
      }
      const resumen = byMesa.get(mesaId)!
      const items = ((p.items_pedido ?? []) as Array<{
        id: string; producto_id: string | null; producto_nombre: string; cantidad: number
        precio_unitario: number; subtotal: number; notas: string | null
        items_pedido_customizacion?: Array<{
          id: string
          tipo: 'extra' | 'removido' | 'modificado'
          precio_extra: number | null
          motivo: string | null
          ingredientes: { nombre: string | null } | Array<{ nombre: string | null }> | null
        }>
      }>)
      resumen.pedidos.push({
        id: p.id,
        numero_pedido: p.numero_pedido,
        estado_pedido: p.estado_pedido as 'EDIT' | 'FACT',
        total: p.total,
        created_at: p.created_at,
        items: items.map((item) => ({
          ...item,
          is_fuera_carta: item.producto_id == null,
          customizaciones: (item.items_pedido_customizacion ?? []).map((c) => ({
            id: c.id,
            tipo: c.tipo,
            precio_extra: Number(c.precio_extra ?? 0),
            ingrediente_nombre: Array.isArray(c.ingredientes)
              ? (c.ingredientes[0]?.nombre ?? null)
              : (c.ingredientes?.nombre ?? c.motivo ?? null),
          })),
        })),
      })
      resumen.total_items     += items.reduce((s, i) => s + i.cantidad, 0)
      resumen.total_acumulado += p.total
    }

    return Array.from(byMesa.values())
  },

  /**
   * Resumen editable tipo “mesa” para un pedido sin mesa (p. ej. para llevar).
   * Solo pedidos con `mesa_id` nulo del tenant.
   */
  async getResumenPedidoById(params: { tenantId: string; pedidoId: string }): Promise<ResumenMesa | null> {
    const supabase = createClient()
    const { data: p, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        estado_pedido,
        total,
        mesa_id,
        created_at,
        items_pedido (
          id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          subtotal,
          notas,
          items_pedido_customizacion (
            id,
            tipo,
            precio_extra,
            motivo,
            ingredientes:ingrediente_id (
              nombre
            )
          )
        )
      `)
      .eq('tenant_id', params.tenantId)
      .eq('id', params.pedidoId)
      .maybeSingle()

    if (error) throw error
    if (!p) return null
    if (p.mesa_id != null) return null

    const items = ((p.items_pedido ?? []) as Array<{
      id: string
      producto_id: string | null
      producto_nombre: string
      cantidad: number
      precio_unitario: number
      subtotal: number
      notas: string | null
      items_pedido_customizacion?: Array<{
        id: string
        tipo: 'extra' | 'removido' | 'modificado'
        precio_extra: number | null
        motivo: string | null
        ingredientes: { nombre: string | null } | Array<{ nombre: string | null }> | null
      }>
    }>)

    const pedidoResumen = {
      id: p.id,
      numero_pedido: p.numero_pedido,
      estado_pedido: p.estado_pedido as 'EDIT' | 'FACT',
      total: p.total,
      created_at: p.created_at,
      items: items.map((item) => ({
        ...item,
        is_fuera_carta: item.producto_id == null,
        customizaciones: (item.items_pedido_customizacion ?? []).map((c) => ({
          id: c.id,
          tipo: c.tipo,
          precio_extra: Number(c.precio_extra ?? 0),
          ingrediente_nombre: Array.isArray(c.ingredientes)
            ? (c.ingredientes[0]?.nombre ?? null)
            : (c.ingredientes?.nombre ?? c.motivo ?? null),
        })),
      })),
    }

    const total_items = items.reduce((s, i) => s + i.cantidad, 0)
    const total_acumulado = Number(p.total ?? 0)

    return {
      mesa_id: 'para_llevar',
      pedidos: [pedidoResumen],
      total_items,
      total_acumulado,
    }
  },

  async addProductoManualAPedido(params: {
    tenantId: string
    pedidoId: string
    nombre: string
    precioGs: number
  }): Promise<void> {
    const supabase = createClient()
    const nombre = params.nombre.trim()
    const precio = Math.max(0, Math.round(Number(params.precioGs) || 0))
    if (!nombre) throw new Error('Ingresá el nombre del producto.')

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, total, mesa_id, estado, estado_pedido')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.pedidoId)
      .maybeSingle()

    if (pedidoError) throw new Error(`No se pudo obtener el pedido: ${pedidoError.message}`)
    if (!pedido) throw new Error('El pedido no existe.')
    if (pedido.mesa_id != null) throw new Error('Este pedido está vinculado a una mesa.')
    if (pedido.estado === 'cancelado') throw new Error('El pedido está cancelado.')

    const { error: insertItemError } = await supabase.from('items_pedido').insert({
      pedido_id: pedido.id,
      producto_id: null,
      producto_nombre: nombre,
      cantidad: 1,
      precio_unitario: precio,
      subtotal: precio,
      notas: null,
    })

    if (insertItemError) throw new Error(`No se pudo agregar el producto: ${insertItemError.message}`)

    const totalActual = Number(pedido.total ?? 0)
    const { error: updatePedidoError } = await supabase
      .from('pedidos')
      .update({ total: totalActual + precio, updated_at: new Date().toISOString() })
      .eq('id', pedido.id)
      .eq('tenant_id', params.tenantId)

    if (updatePedidoError) throw new Error(`No se pudo actualizar el total del pedido: ${updatePedidoError.message}`)
  },

  async addProductoManualEnMesa(params: {
    tenantId: string
    mesaId: string
    nombre: string
    precioGs: number
  }): Promise<void> {
    const supabase = createClient()
    const nombre = params.nombre.trim()
    const precio = Math.max(0, Math.round(Number(params.precioGs) || 0))
    if (!nombre) throw new Error('Ingresá el nombre del producto.')

    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, total')
      .eq('tenant_id', params.tenantId)
      .eq('mesa_id', params.mesaId)
      .in('estado_pedido', ['EDIT', 'FACT'])
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pedidoError) throw new Error(`No se pudo obtener el pedido de mesa: ${pedidoError.message}`)
    if (!pedido) throw new Error('No hay pedido activo en esta mesa para agregar producto.')

    const { error: insertItemError } = await supabase
      .from('items_pedido')
      .insert({
        pedido_id: pedido.id,
        producto_id: null,
        producto_nombre: nombre,
        cantidad: 1,
        precio_unitario: precio,
        subtotal: precio,
        notas: null,
      })

    if (insertItemError) throw new Error(`No se pudo agregar el producto: ${insertItemError.message}`)

    const totalActual = Number(pedido.total ?? 0)
    const { error: updatePedidoError } = await supabase
      .from('pedidos')
      .update({ total: totalActual + precio, updated_at: new Date().toISOString() })
      .eq('id', pedido.id)
      .eq('tenant_id', params.tenantId)

    if (updatePedidoError) throw new Error(`No se pudo actualizar el total del pedido: ${updatePedidoError.message}`)

    enqueueReprintCocinaTrasEdicionDetalle(pedido.id, params.tenantId)
  },

  /**
   * Reemplaza la línea `items_pedido` por otro producto del catálogo (misma cantidad).
   * Quita extras/modificaciones de la línea; recalcula total del pedido y encola reimpresión cocina.
   * No admite productos tipo combo (definidos en `combo_items`).
   */
  async reemplazarItemPedidoPorProductoCatalogo(params: {
    tenantId: string
    itemPedidoId: string
    nuevoProductoId: string
  }): Promise<{ pedidoId: string }> {
    const supabase = createClient()

    const { data: itemRow, error: itemError } = await supabase
      .from('items_pedido')
      .select(`
        id,
        pedido_id,
        cantidad,
        pedidos!inner (
          id,
          tenant_id,
          total,
          estado,
          estado_pedido,
          mesa_id
        )
      `)
      .eq('id', params.itemPedidoId)
      .eq('pedidos.tenant_id', params.tenantId)
      .single()

    if (itemError || !itemRow) {
      throw new Error('No se encontró el ítem del pedido o no pertenece a este local.')
    }

    const pedido = Array.isArray(itemRow.pedidos) ? itemRow.pedidos[0] : itemRow.pedidos
    if (!pedido) throw new Error('No se pudo validar el pedido del ítem.')
    if (pedido.estado === 'cancelado') throw new Error('No se puede editar un pedido cancelado.')
    if (!['EDIT', 'FACT'].includes(pedido.estado_pedido)) {
      throw new Error('Solo se pueden editar pedidos abiertos o confirmados.')
    }
    if (pedido.mesa_id == null) {
      throw new Error('Este ítem no pertenece a un pedido con mesa.')
    }

    const { data: comboProbe, error: comboErr } = await supabase
      .from('combo_items')
      .select('id')
      .eq('combo_id', params.nuevoProductoId)
      .limit(1)

    if (comboErr) {
      throw new Error(`No se pudo validar el producto: ${comboErr.message}`)
    }
    if (comboProbe && comboProbe.length > 0) {
      throw new Error(
        'Los combos no se pueden elegir como reemplazo aquí. Usá el punto de venta para cargar un combo.'
      )
    }

    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio, tasa_iva, disponible, is_deleted')
      .eq('tenant_id', params.tenantId)
      .eq('id', params.nuevoProductoId)
      .maybeSingle()

    if (prodError || !producto) {
      throw new Error('No se encontró el producto en el catálogo.')
    }
    if (producto.is_deleted) throw new Error('El producto está dado de baja.')
    if (!producto.disponible) throw new Error('El producto no está disponible.')

    const cantidad = Math.max(1, Math.floor(Number(itemRow.cantidad ?? 1)))
    const precioUnit = Math.max(0, Math.round(Number(producto.precio ?? 0)))
    const subtotal = Math.round(cantidad * precioUnit * 100) / 100
    const { iva_porcentaje, monto_iva } = montoIvaLineaDesdeSubtotalIncluido(
      subtotal,
      Number(producto.tasa_iva ?? 10)
    )

    const { error: delCustError } = await supabase
      .from('items_pedido_customizacion')
      .delete()
      .eq('item_pedido_id', params.itemPedidoId)

    if (delCustError) {
      throw new Error(`No se pudieron quitar modificaciones del ítem: ${delCustError.message}`)
    }

    const nowIso = new Date().toISOString()
    const { error: updItemError } = await supabase
      .from('items_pedido')
      .update({
        producto_id: params.nuevoProductoId,
        producto_nombre: producto.nombre,
        precio_unitario: precioUnit,
        subtotal,
        notas: null,
        iva_porcentaje,
        monto_iva,
      })
      .eq('id', params.itemPedidoId)

    if (updItemError) {
      throw new Error(`No se pudo actualizar el ítem: ${updItemError.message}`)
    }

    const { data: sumRows, error: sumErr } = await supabase
      .from('items_pedido')
      .select('subtotal')
      .eq('pedido_id', itemRow.pedido_id)

    if (sumErr) {
      throw new Error(`No se pudo recalcular el total: ${sumErr.message}`)
    }

    const nuevoTotal = (sumRows ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)
    const { error: updPedidoError } = await supabase
      .from('pedidos')
      .update({ total: nuevoTotal, updated_at: nowIso })
      .eq('id', itemRow.pedido_id)
      .eq('tenant_id', params.tenantId)

    if (updPedidoError) {
      throw new Error(`No se pudo actualizar el total del pedido: ${updPedidoError.message}`)
    }

    enqueueReprintCocinaTrasEdicionDetalle(itemRow.pedido_id, params.tenantId)

    return { pedidoId: itemRow.pedido_id }
  },

  /**
   * Elimina una línea del pedido (detalle antes de cerrar cuenta).
   * Revierte inventario de esa línea, recalcula total y encola reimpresión cocina.
   */
  async eliminarItemPedido(params: {
    tenantId: string
    itemPedidoId: string
    usuarioId?: string | null
  }): Promise<{ pedidoId: string }> {
    const supabase = createClient()

    const { data: itemRow, error: itemError } = await supabase
      .from('items_pedido')
      .select(`
        id,
        pedido_id,
        producto_id,
        producto_nombre,
        cantidad,
        precio_unitario,
        subtotal,
        notas,
        pedidos!inner (
          id,
          tenant_id,
          numero_pedido,
          total,
          estado,
          estado_pedido,
          mesa_id
        ),
        items_pedido_customizacion (
          tipo,
          precio_extra,
          cantidad_original,
          cantidad_ajustada,
          ingredientes:ingrediente_id (
            slug,
            nombre
          )
        )
      `)
      .eq('id', params.itemPedidoId)
      .eq('pedidos.tenant_id', params.tenantId)
      .single()

    if (itemError || !itemRow) {
      throw new Error('No se encontró el ítem del pedido o no pertenece a este local.')
    }

    const pedido = Array.isArray(itemRow.pedidos) ? itemRow.pedidos[0] : itemRow.pedidos
    if (!pedido) throw new Error('No se pudo validar el pedido del ítem.')
    if (pedido.estado === 'cancelado') throw new Error('No se puede editar un pedido cancelado.')
    if (!['EDIT', 'FACT'].includes(pedido.estado_pedido)) {
      throw new Error('Solo se pueden editar pedidos abiertos o confirmados.')
    }

    if (itemRow.producto_id) {
      const { data: comboProbe, error: comboErr } = await supabase
        .from('combo_items')
        .select('id')
        .eq('combo_id', itemRow.producto_id)
        .limit(1)

      if (comboErr) {
        throw new Error(`No se pudo validar el producto: ${comboErr.message}`)
      }
      if (comboProbe && comboProbe.length > 0) {
        throw new Error(
          'Los combos no se pueden quitar desde el detalle de cuenta. Usá el punto de venta.'
        )
      }
    }

    const itemForRevert: ItemPedidoForRevert = {
      id: itemRow.id,
      producto_id: itemRow.producto_id,
      producto_nombre: itemRow.producto_nombre,
      cantidad: itemRow.cantidad,
      precio_unitario: itemRow.precio_unitario,
      subtotal: itemRow.subtotal,
      notas: itemRow.notas,
      items_pedido_customizacion: (itemRow.items_pedido_customizacion ?? []) as ItemPedidoForRevert['items_pedido_customizacion'],
    }

    const invResult = await revertirIngredientesPorItemPedido({
      tenantId: params.tenantId,
      item: itemForRevert,
      pedidoId: itemRow.pedido_id,
      pedidoNumero: pedido.numero_pedido,
      usuarioId: params.usuarioId ?? null,
    })
    if (!invResult.success) {
      throw new Error(
        invResult.errores[0] ?? 'No se pudo revertir el inventario de esta línea.'
      )
    }

    const { error: delCustError } = await supabase
      .from('items_pedido_customizacion')
      .delete()
      .eq('item_pedido_id', params.itemPedidoId)

    if (delCustError) {
      throw new Error(`No se pudieron quitar modificaciones del ítem: ${delCustError.message}`)
    }

    const { error: delItemError } = await supabase
      .from('items_pedido')
      .delete()
      .eq('id', params.itemPedidoId)

    if (delItemError) {
      throw new Error(`No se pudo eliminar el ítem: ${delItemError.message}`)
    }

    const { data: sumRows, error: sumErr } = await supabase
      .from('items_pedido')
      .select('subtotal')
      .eq('pedido_id', itemRow.pedido_id)

    if (sumErr) {
      throw new Error(`No se pudo recalcular el total: ${sumErr.message}`)
    }

    const nuevoTotal = (sumRows ?? []).reduce((s, r) => s + Number(r.subtotal ?? 0), 0)
    const nowIso = new Date().toISOString()
    const { error: updPedidoError } = await supabase
      .from('pedidos')
      .update({ total: nuevoTotal, updated_at: nowIso })
      .eq('id', itemRow.pedido_id)
      .eq('tenant_id', params.tenantId)

    if (updPedidoError) {
      throw new Error(`No se pudo actualizar el total del pedido: ${updPedidoError.message}`)
    }

    enqueueReprintCocinaTrasEdicionDetalle(itemRow.pedido_id, params.tenantId)
    void broadcastMesasChanged(params.tenantId, 'eliminarItem')

    return { pedidoId: itemRow.pedido_id }
  },
}
