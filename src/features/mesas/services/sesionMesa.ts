/**
 * Sesión de una mesa: ventana de pedidos que pertenecen a la cuenta abierta
 * actualmente en la mesa.
 *
 * El corte de sesión es el último evento `liberar_mesa` de la mesa. Los pedidos
 * creados antes de ese corte son de una sesión anterior… salvo que hayan sido
 * re-asociados a la mesa DESPUÉS del corte (p. ej. "mover pedido" desde otra
 * mesa: el pedido conserva su `created_at` original, que puede ser anterior a
 * la última liberación de la mesa destino). Para esos casos se usan los eventos
 * `ocupar_mesa` / `mover_pedido` que llevan `pedido_id`.
 */

/** Eventos que vinculan un pedido concreto a una mesa (llevan `pedido_id`). */
export const TIPOS_EVENTO_VINCULO_PEDIDO_MESA = ['ocupar_mesa', 'mover_pedido']

export interface EventoSesionMesa {
  mesa_id: string | null
  pedido_id?: string | null
  tipo: string
  created_at: string
}

export interface SesionMesa {
  /** ISO del último `liberar_mesa`; `null` si la mesa nunca fue liberada. */
  cutoff: string | null
  /** Pedidos vinculados a la mesa después del corte (mover_pedido / ocupar_mesa con pedido_id). */
  pedidosVinculados: Set<string>
}

export interface PedidoSesionLike {
  id: string
  mesa_id: string | null
  created_at: string
}

/** Dígitos de fracción de segundo (hasta microsegundos) normalizados a 6 posiciones. */
function fraccionMicros(iso: string): number {
  const m = /\.(\d{1,6})/.exec(iso)
  if (!m) return 0
  return Number(m[1].padEnd(6, '0'))
}

/**
 * Compara timestamps ISO (Postgres devuelve microsegundos; Date.parse solo
 * resuelve milisegundos, por eso se desempata con la fracción completa).
 * Cae a comparación lexicográfica si no parsean.
 */
export function compararFechasIso(a: string, b: string): number {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isFinite(ta) && Number.isFinite(tb)) {
    if (ta !== tb) return ta < tb ? -1 : 1
    const fa = fraccionMicros(a)
    const fb = fraccionMicros(b)
    return fa === fb ? 0 : fa < fb ? -1 : 1
  }
  return a === b ? 0 : a < b ? -1 : 1
}

/**
 * Construye la sesión vigente de cada mesa a partir de sus eventos.
 * Acepta los eventos en cualquier orden.
 */
export function construirSesionesMesa(eventos: EventoSesionMesa[]): Map<string, SesionMesa> {
  const porMesa = new Map<string, EventoSesionMesa[]>()
  for (const ev of eventos) {
    if (!ev?.mesa_id || !ev?.created_at) continue
    const arr = porMesa.get(ev.mesa_id) ?? []
    arr.push(ev)
    porMesa.set(ev.mesa_id, arr)
  }

  const sesiones = new Map<string, SesionMesa>()
  for (const [mesaId, evs] of porMesa) {
    let cutoff: string | null = null
    for (const ev of evs) {
      if (ev.tipo !== 'liberar_mesa') continue
      if (!cutoff || compararFechasIso(ev.created_at, cutoff) > 0) cutoff = ev.created_at
    }

    const pedidosVinculados = new Set<string>()
    for (const ev of evs) {
      if (ev.tipo !== 'ocupar_mesa' && ev.tipo !== 'mover_pedido') continue
      if (!ev.pedido_id) continue
      if (cutoff && compararFechasIso(ev.created_at, cutoff) < 0) continue
      pedidosVinculados.add(ev.pedido_id)
    }

    sesiones.set(mesaId, { cutoff, pedidosVinculados })
  }
  return sesiones
}

/**
 * Un pedido pertenece a la sesión actual de su mesa si:
 *  - la mesa nunca fue liberada, o
 *  - fue creado en/después del último `liberar_mesa` (no estricto: evita descartar
 *    pedidos creados en el mismo instante por colisión de microsegundos), o
 *  - fue vinculado a la mesa después de ese corte (movido desde otra mesa).
 */
export function pedidoPerteneceASesion(
  pedido: PedidoSesionLike,
  sesiones: Map<string, SesionMesa>
): boolean {
  if (!pedido.mesa_id) return false
  const sesion = sesiones.get(pedido.mesa_id)
  if (!sesion || !sesion.cutoff) return true
  if (sesion.pedidosVinculados.has(pedido.id)) return true
  return compararFechasIso(pedido.created_at, sesion.cutoff) >= 0
}

export function filtrarPedidosSesionMesa<T extends PedidoSesionLike>(
  pedidos: T[],
  sesiones: Map<string, SesionMesa>
): T[] {
  return pedidos.filter((p) => pedidoPerteneceASesion(p, sesiones))
}

/**
 * Filtro PostgREST (`.or(...)`) para traer del servidor SOLO los pedidos de la
 * sesión vigente de cada mesa. Necesario porque PostgREST recorta la respuesta
 * a `max-rows` (1000 por defecto) y con cientos de pedidos FACT históricos por
 * mesa el recorte dejaba afuera justamente los pedidos más nuevos.
 *
 * Devuelve `null` cuando ninguna mesa tiene corte (no hace falta filtrar).
 */
export function construirFiltroSesionPedidos(
  mesaIds: string[],
  sesiones: Map<string, SesionMesa>
): string | null {
  const mesasSinCorte: string[] = []
  let cutoffMasAntiguo: string | null = null
  const vinculados = new Set<string>()

  for (const mesaId of mesaIds) {
    const sesion = sesiones.get(mesaId)
    if (!sesion?.cutoff) {
      mesasSinCorte.push(mesaId)
      continue
    }
    if (!cutoffMasAntiguo || compararFechasIso(sesion.cutoff, cutoffMasAntiguo) < 0) {
      cutoffMasAntiguo = sesion.cutoff
    }
    for (const id of sesion.pedidosVinculados) vinculados.add(id)
  }

  if (!cutoffMasAntiguo) return null

  const partes = [`created_at.gte.${cutoffMasAntiguo}`]
  if (mesasSinCorte.length > 0) partes.push(`mesa_id.in.(${mesasSinCorte.join(',')})`)
  if (vinculados.size > 0) partes.push(`id.in.(${Array.from(vinculados).join(',')})`)
  return partes.join(',')
}
