# Agente: reimpresión solo cocina / solo factura (`reprint_solicitud`)

**Importante:** en la **emisión inicial** (pedido que pasa a `FACT` con factura), el negocio requiere **dos** copias de factura (cliente + local). Eso se implementa en el listener de **pedidos**, no duplicando filas en `reprint_solicitud`. En **`reprint_solicitud`** con `tipo = 'factura'`, cada **INSERT = una sola** impresión de factura (reimpresión desde POS/historial).

Detalle: [`AGENTE_FACTURA_EMISION_DOS_COPIAS.md`](AGENTE_FACTURA_EMISION_DOS_COPIAS.md).

La app ya **no** hace `UPDATE pedidos.updated_at` para “Reimprimir cocina”, porque varios agentes tratan ese evento como **pedido FACT completo** y vuelven a imprimir **cocina y factura**.

En su lugar inserta filas en **`public.reprint_solicitud`** (`tipo` = `'cocina'` | `'factura'`). El agente debe reaccionar a **INSERT** en esa tabla y respetar el tipo.

## Regla de Mesas

- Pedido con `mesa_id` al confirmar (`EDIT -> FACT`): solo cocina, sin factura.
- Factura de mesa se imprime al cerrar cuenta mediante `reprint_solicitud.tipo='factura'`.
- Cada cierre de cuenta de mesa imprime 1 factura por `INSERT`.

Contrato unificado: [`CONTRATO_MESAS_IMPRESION_OPERATIVO.md`](CONTRATO_MESAS_IMPRESION_OPERATIVO.md).

## Qué hacer en el agente (listener Supabase)

1. Suscribirse a `postgres_changes` con `event: 'INSERT'`, `schema: 'public'`, `table: 'reprint_solicitud'`, filtrando por `tenant_id` como ya hacés con pedidos.
2. Al recibir un registro nuevo:
   - **`tipo === 'cocina'`** → **solo** ticket de cocina (p. ej. `vista_items_ticket_cocina` + pedido/tenant/cliente). No factura.
   - **`tipo === 'factura'`** → **solo** factura (p. ej. `vista_factura_impresion` por `pedido_id`). No ticket de cocina.

3. Deduplicación: podés usar `reprint_solicitud.id` (siempre nuevo) o `id + created_at`.

Llave recomendada por canal:

- `pedidos` (emisión inicial): `pedido_id + transicion_a_FACT`.
- `reprint_solicitud` (reimpresión): `reprint_solicitud.id`.

## SQL en Supabase

Ejecutar [`database/14_reprint_solicitud.sql`](../database/14_reprint_solicitud.sql) y habilitar **Realtime** para la tabla `reprint_solicitud` si la publicación no la incluyó automáticamente. Para alinear el RPC `bump_factura_reprint` con la cola: [`15_bump_factura_reprint_solicitud.sql`](../database/15_bump_factura_reprint_solicitud.sql).

## RPC

- Tras **14**: `bump_pedido_reprint_cocina` hace **INSERT** en `reprint_solicitud` (tipo cocina), no actualiza `pedidos`.
- Tras **15**: `bump_factura_reprint` hace **INSERT** en `reprint_solicitud` (tipo factura), no actualiza `facturas.updated_at`.

## Prompt listo para pegar en el repo del agente

Ver **[`PROMPT_AGENTE_REIMPRESION.md`](PROMPT_AGENTE_REIMPRESION.md)** (bloque copiable con contexto, qué suscribir y qué implementar).
