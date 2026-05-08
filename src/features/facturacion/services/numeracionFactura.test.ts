import { describe, expect, it } from 'vitest'
import {
  buildPrefijoNumeracion,
  esErrorNumeroFacturaDuplicado,
  parseSecuenciaNumerica,
  siguienteSecuenciaFactura,
} from './numeracionFactura'

describe('numeracionFactura', () => {
  it('parseSecuenciaNumerica extrae el sufijo numérico', () => {
    const p = buildPrefijoNumeracion('001', '001')
    expect(parseSecuenciaNumerica('001-001-0000074', p)).toBe(74)
    expect(parseSecuenciaNumerica('002-001-0000074', p)).toBeNull()
  })

  it('siguienteSecuenciaFactura usa el máximo entre config y tabla', () => {
    expect(siguienteSecuenciaFactura(73, 74)).toBe(75)
    expect(siguienteSecuenciaFactura(80, 74)).toBe(81)
    expect(siguienteSecuenciaFactura(0, 0)).toBe(1)
  })

  it('esErrorNumeroFacturaDuplicado detecta 23505', () => {
    expect(esErrorNumeroFacturaDuplicado({ code: '23505', message: 'dup' })).toBe(true)
    expect(
      esErrorNumeroFacturaDuplicado({
        message: 'duplicate key value violates unique constraint "facturas_numero_tenant_unique"',
      })
    ).toBe(true)
    expect(esErrorNumeroFacturaDuplicado({ code: '42P01', message: 'no such table' })).toBe(false)
  })
})
