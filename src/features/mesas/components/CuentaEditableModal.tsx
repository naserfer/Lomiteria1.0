'use client'

/**
 * Cuenta editable sin depender de una mesa física (p. ej. para llevar desde POS sin mesa).
 * Reutiliza la UI de edición/cierre de `DetalleMesaModal` en modo `takeawayAccountMode`.
 */
import { DetalleMesaModal, type DetalleMesaModalProps } from './DetalleMesaModal'

export type CuentaEditableModalProps = Omit<
  DetalleMesaModalProps,
  'takeawayAccountMode' | 'reservasMesa' | 'showOperationalActions' | 'showSplitActions'
>

export function CuentaEditableModal(props: CuentaEditableModalProps) {
  return (
    <DetalleMesaModal
      {...props}
      reservasMesa={[]}
      takeawayAccountMode
      showOperationalActions={false}
      showSplitActions={false}
    />
  )
}
