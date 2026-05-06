import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CuentaEditableModal } from './CuentaEditableModal'

const mockDetalleMesaModal = vi.fn(() => null)

vi.mock('./DetalleMesaModal', () => ({
  DetalleMesaModal: (props: unknown) => mockDetalleMesaModal(props),
}))

describe('CuentaEditableModal', () => {
  it('reutiliza DetalleMesaModal en modo takeaway con props fijas', () => {
    render(
      <CuentaEditableModal
        tenantId="tenant-1"
        mesa={{
          id: 'virtual',
          tenant_id: 'tenant-1',
          numero: 0,
          nombre: 'Para llevar',
          capacidad: 0,
          estado: 'ocupada',
          activa: true,
          orden: 0,
          created_at: '',
          updated_at: '',
        }}
        resumenPedido={null}
        loadingResumen={false}
        feedback={null}
        onClose={() => undefined}
      />,
    )

    expect(mockDetalleMesaModal).toHaveBeenCalledTimes(1)
    const props = mockDetalleMesaModal.mock.calls[0][0] as Record<string, unknown>
    expect(props.takeawayAccountMode).toBe(true)
    expect(props.reservasMesa).toEqual([])
    expect(props.showOperationalActions).toBe(false)
    expect(props.showSplitActions).toBe(false)
  })
})
