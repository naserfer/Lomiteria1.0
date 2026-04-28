# Contrato Mesas: Cocina Inmediata, Factura Diferida

Este documento define el contrato operativo entre Karubox (origen de eventos) y el agente de impresion (ejecutor de tickets) para pedidos con mesa.

## Decision de arquitectura

- La emision fiscal real la hace Karubox al cerrar cuenta (crea fila en `public.facturas`).
- El agente de impresion no emite facturas; solo imprime en base a eventos de `pedidos` y `reprint_solicitud`.

## Reglas compartidas

### 1) Emision inicial al confirmar pedido (`EDIT -> FACT`)

- Si `mesa_id` tiene valor:
  - imprimir solo ticket de cocina.
  - no imprimir factura en esta fase.
  - no mostrar el resumen normal de confirmacion en POS (la mesa queda con cuenta abierta).
- Si `mesa_id` es `null`:
  - mantener flujo normal actual.
  - si existe factura para el pedido, imprimir cocina + factura.
  - para emitir/imprimir factura en este flujo, `ENABLE_INVOICE_PRINTING=true` debe estar activo.

### 2) Cierre de cuenta de mesa (accion explicita)

El cierre de cuenta debe estar disponible en POS (modo mesa) y en el panel Mesas.

Karubox ejecuta en este orden:

1. Emite fiscalmente (inserta en `public.facturas` para `pedido_id`).
2. Encola impresion:

```sql
INSERT INTO public.reprint_solicitud (tenant_id, pedido_id, tipo)
VALUES (:tenant_id, :pedido_id, 'factura');
```

El agente al recibir `tipo='factura'` imprime solo factura.

Al finalizar el cierre, la mesa debe pasar automaticamente a estado `libre`.

### 3) Reimpresion manual

- `reprint_solicitud.tipo='cocina'`: solo cocina.
- `reprint_solicitud.tipo='factura'`: solo factura.

## Politica de copias

- Pedido sin mesa (emision inicial con factura): 2 copias de factura.
- Pedido con mesa al confirmar: 0 copias de factura.
- Cierre de cuenta de mesa (`reprint_solicitud.tipo='factura'`): 1 copia.
- Reimpresion manual de factura: 1 copia por cada `INSERT`.

## Idempotencia obligatoria

### Canal `pedidos` (emision inicial)

- Disparar solo en transicion real a FACT:
  - `old.estado_pedido != 'FACT'`
  - `new.estado_pedido == 'FACT'`
- Deduplicar por evento/pedido para evitar duplicados en reconexion.

### Canal `reprint_solicitud`

- Tratar cada fila por `reprint_solicitud.id` como unidad de trabajo.
- No reimprimir si ya fue procesada esa misma `id`.

## Criterios de aceptacion E2E

1. Pedido con mesa confirmado: imprime cocina, no factura.
2. Pedido sin mesa confirmado con factura: imprime cocina + 2 facturas.
3. Cierre de cuenta de mesa: Karubox crea factura y luego imprime 1 factura por cola.
4. Reimpresion manual:
   - cocina => solo cocina
   - factura => solo factura
5. Reconexion/reintentos no generan impresiones duplicadas.

## Plan minimo de validacion compartida

- Caso A (mesa, confirmacion):
  - accion: confirmar pedido con `mesa_id`.
  - esperado: 1 cocina, 0 factura.
- Caso B (mesa, cierre):
  - accion: Karubox crea `facturas` y luego `reprint_solicitud.tipo='factura'`.
  - esperado: 1 factura.
- Caso C (sin mesa):
  - accion: confirmar pedido sin `mesa_id` con factura emitida.
  - esperado: 1 cocina + 2 facturas.
- Caso D (reprint manual):
  - accion: `reprint_solicitud.tipo='cocina'` y luego `tipo='factura'`.
  - esperado: solo cocina en el primero, solo factura en el segundo.
- Caso E (idempotencia):
  - accion: reconectar listener / reintentar entrega del mismo evento.
  - esperado: no duplicar impresiones para la misma unidad de trabajo.

## Referencias

- `docs/INSTRUCCIONES_AGENTE_IMPRESION.md`
- `docs/AGENTE_REPRINT_SOLICITUD.md`
- `docs/AGENTE_FACTURA_EMISION_DOS_COPIAS.md`
- `database/14_reprint_solicitud.sql`
