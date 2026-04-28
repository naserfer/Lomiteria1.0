import { createClient } from '@/lib/supabase/client'
import type { EstadoMesa, Mesa, MesaReserva, MesaUnion, MesaUnionItem, PedidoDivision } from '../types/mesas.types'

const MESAS_SELECT = 'id, tenant_id, numero, nombre, capacidad, estado, activa, orden, created_at, updated_at'

export const mesasService = {
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
}
