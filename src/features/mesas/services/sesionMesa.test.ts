import { describe, expect, it } from 'vitest'
import {
  compararFechasIso,
  construirFiltroSesionPedidos,
  construirSesionesMesa,
  filtrarPedidosSesionMesa,
  pedidoPerteneceASesion,
} from './sesionMesa'

const MESA_A = 'mesa-a'
const MESA_B = 'mesa-b'

describe('compararFechasIso', () => {
  it('compara timestamps con distinta precisión de fracción', () => {
    expect(compararFechasIso('2026-05-22T18:23:19.12+00:00', '2026-05-22T18:23:19.123456+00:00')).toBe(-1)
    expect(compararFechasIso('2026-05-22T18:23:19+00:00', '2026-05-22T18:23:19.000001+00:00')).toBe(-1)
    expect(compararFechasIso('2026-05-22T18:23:19.5+00:00', '2026-05-22T18:23:19.123+00:00')).toBe(1)
  })

  it('trata instantes iguales con distinto offset como iguales', () => {
    expect(compararFechasIso('2026-05-22T15:00:00-03:00', '2026-05-22T18:00:00+00:00')).toBe(0)
  })
})

describe('construirSesionesMesa', () => {
  it('sin eventos: no hay sesión (todo pedido pertenece)', () => {
    const sesiones = construirSesionesMesa([])
    expect(sesiones.size).toBe(0)
    expect(pedidoPerteneceASesion({ id: 'p1', mesa_id: MESA_A, created_at: '2026-01-01T00:00:00+00:00' }, sesiones)).toBe(true)
  })

  it('usa el último liberar_mesa como corte aunque los eventos vengan desordenados', () => {
    const sesiones = construirSesionesMesa([
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-01T10:00:00+00:00' },
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-03T10:00:00+00:00' },
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-02T10:00:00+00:00' },
    ])
    expect(sesiones.get(MESA_A)?.cutoff).toBe('2026-05-03T10:00:00+00:00')
  })

  it('ignora eventos sin mesa_id o sin created_at', () => {
    const sesiones = construirSesionesMesa([
      { mesa_id: null, tipo: 'liberar_mesa', created_at: '2026-05-03T10:00:00+00:00' },
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '' },
    ])
    expect(sesiones.size).toBe(0)
  })
})

describe('pedidoPerteneceASesion', () => {
  const sesiones = construirSesionesMesa([
    { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-03T10:00:00+00:00' },
    // Pedido movido a A después del corte (su created_at es anterior al corte).
    { mesa_id: MESA_A, tipo: 'mover_pedido', pedido_id: 'p-movido', created_at: '2026-05-03T12:00:00+00:00' },
    { mesa_id: MESA_A, tipo: 'ocupar_mesa', pedido_id: 'p-movido', created_at: '2026-05-03T12:00:00+00:00' },
    // Vinculación anterior al corte: pertenece a la sesión ya cerrada.
    { mesa_id: MESA_A, tipo: 'ocupar_mesa', pedido_id: 'p-viejo-vinculado', created_at: '2026-05-02T09:00:00+00:00' },
    // ocupar_mesa manual (sin pedido_id) no vincula nada.
    { mesa_id: MESA_A, tipo: 'ocupar_mesa', pedido_id: null, created_at: '2026-05-03T11:00:00+00:00' },
  ])

  it('excluye pedidos creados antes del último liberar_mesa', () => {
    expect(pedidoPerteneceASesion({ id: 'p-viejo', mesa_id: MESA_A, created_at: '2026-05-02T20:00:00+00:00' }, sesiones)).toBe(false)
    expect(pedidoPerteneceASesion({ id: 'p-viejo-vinculado', mesa_id: MESA_A, created_at: '2026-05-02T09:00:00+00:00' }, sesiones)).toBe(false)
  })

  it('incluye pedidos creados en o después del corte (no estricto)', () => {
    expect(pedidoPerteneceASesion({ id: 'p-igual', mesa_id: MESA_A, created_at: '2026-05-03T10:00:00+00:00' }, sesiones)).toBe(true)
    expect(pedidoPerteneceASesion({ id: 'p-nuevo', mesa_id: MESA_A, created_at: '2026-05-03T10:00:01+00:00' }, sesiones)).toBe(true)
  })

  it('incluye un pedido movido a la mesa después del corte aunque sea más viejo (bug reportado)', () => {
    expect(pedidoPerteneceASesion({ id: 'p-movido', mesa_id: MESA_A, created_at: '2026-05-01T08:00:00+00:00' }, sesiones)).toBe(true)
  })

  it('una mesa sin liberar_mesa no descarta nada', () => {
    expect(pedidoPerteneceASesion({ id: 'x', mesa_id: MESA_B, created_at: '2020-01-01T00:00:00+00:00' }, sesiones)).toBe(true)
  })

  it('pedido sin mesa no pertenece a ninguna sesión', () => {
    expect(pedidoPerteneceASesion({ id: 'x', mesa_id: null, created_at: '2026-05-03T12:00:00+00:00' }, sesiones)).toBe(false)
  })

  it('filtrarPedidosSesionMesa conserva el orden y el tipo', () => {
    const pedidos = [
      { id: 'p-viejo', mesa_id: MESA_A, created_at: '2026-05-02T20:00:00+00:00', extra: 1 },
      { id: 'p-movido', mesa_id: MESA_A, created_at: '2026-05-01T08:00:00+00:00', extra: 2 },
      { id: 'p-nuevo', mesa_id: MESA_A, created_at: '2026-05-03T13:00:00+00:00', extra: 3 },
    ]
    expect(filtrarPedidosSesionMesa(pedidos, sesiones).map((p) => p.id)).toEqual(['p-movido', 'p-nuevo'])
  })
})

describe('construirFiltroSesionPedidos', () => {
  it('devuelve null cuando ninguna mesa tiene corte', () => {
    expect(construirFiltroSesionPedidos([MESA_A, MESA_B], construirSesionesMesa([]))).toBeNull()
  })

  it('usa el corte más antiguo entre las mesas y deja sin filtro a las mesas nunca liberadas', () => {
    const sesiones = construirSesionesMesa([
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-03T10:00:00+00:00' },
      { mesa_id: MESA_B, tipo: 'liberar_mesa', created_at: '2026-05-02T10:00:00+00:00' },
    ])
    expect(construirFiltroSesionPedidos([MESA_A, MESA_B, 'mesa-c'], sesiones)).toBe(
      'created_at.gte.2026-05-02T10:00:00+00:00,mesa_id.in.(mesa-c)'
    )
  })

  it('incluye los pedidos vinculados después del corte', () => {
    const sesiones = construirSesionesMesa([
      { mesa_id: MESA_A, tipo: 'liberar_mesa', created_at: '2026-05-03T10:00:00+00:00' },
      { mesa_id: MESA_A, tipo: 'mover_pedido', pedido_id: 'p-movido', created_at: '2026-05-03T12:00:00+00:00' },
      { mesa_id: MESA_A, tipo: 'ocupar_mesa', pedido_id: 'p-viejo', created_at: '2026-05-01T12:00:00+00:00' },
    ])
    expect(construirFiltroSesionPedidos([MESA_A], sesiones)).toBe(
      'created_at.gte.2026-05-03T10:00:00+00:00,id.in.(p-movido)'
    )
  })
})
